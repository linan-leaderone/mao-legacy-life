"""Build version 2's real-world administrative atlas (Python 3 + shapely).

Download caches are private build inputs; runtime output contains attribution,
compact locality metadata and independently loadable country/level geometry.
The 1.11 IDs are retained. Administrative levels are not invented to make all
countries resemble China. Re-run uses the recorded metadata and source hashes.
"""
from pathlib import Path
import concurrent.futures as futures
import hashlib, importlib.util, json, time, urllib.request, re, zipfile
from collections import defaultdict
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/geography'
OUT = ROOT / 'public/maps'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
SCALE = 10000
WORLD_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson'
HK_URL = 'https://www.had.gov.hk/psi/hong-kong-administrative-boundaries/hksar_18_district_boundary.json'
CONTINENTS = {'Asia':'亚洲','Europe':'欧洲','Africa':'非洲','North America':'北美洲','South America':'南美洲','Oceania':'大洋洲','Antarctica':'南极洲','Seven seas (open ocean)':'远洋岛屿'}
SUBREGIONS = {'Eastern Asia':'东亚','South-Eastern Asia':'东南亚','Southern Asia':'南亚','Central Asia':'中亚','Western Asia':'西亚','Northern Europe':'北欧','Western Europe':'西欧','Eastern Europe':'东欧','Southern Europe':'南欧','Northern Africa':'北非','Western Africa':'西非','Middle Africa':'中非','Eastern Africa':'东非','Southern Africa':'南部非洲','Northern America':'北美','Central America':'中美洲','Caribbean':'加勒比','South America':'南美洲','Australia and New Zealand':'澳大利亚与新西兰','Melanesia':'美拉尼西亚','Micronesia':'密克罗尼西亚','Polynesia':'波利尼西亚','Antarctica':'南极洲','Seven seas (open ocean)':'远洋岛屿'}
SUBREGIONS['Northern Asia']='北亚'
REGIONS = {'CHN':'china','TWN':'taiwan','JPN':'japan','HKG':'hongkong','MAC':'macau','KOR':'korea'}
EXTRA_LEVELS = [('CHN','ADM3'),('PHL','ADM3'),('MMR','ADM3')]
SPEC = importlib.util.spec_from_file_location('previous_atlas',ROOT/'scripts/build-world-geography.py')
OLD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OLD)

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def write(path,data): path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def download(url,path):
    if path.exists(): return path
    error = None
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'MaoLegacyLife-offline-atlas/1.12'})
            with urllib.request.urlopen(req,timeout=100) as response:
                data=response.read()
            # Atomic writes avoid mistaking an interrupted download for a cache.
            partial=path.with_suffix(path.suffix+'.part')
            partial.write_bytes(data);partial.replace(path)
            return path
        except Exception as exc:
            error=exc
            if attempt<3:time.sleep(attempt+1)
    raise error

def encode(geom,tolerance=.0025):
    if not geom.is_valid: geom=geom.buffer(0)
    geom=geom.simplify(tolerance,preserve_topology=True)
    if geom.geom_type not in ('Polygon','MultiPolygon'): return []
    coordinates=mapping(geom)['coordinates']
    if geom.geom_type=='Polygon':coordinates=[coordinates]
    result=[]
    for polygon in coordinates:
        rings=[]
        for ring in polygon:
            values=[];last=(0,0)
            for x,y,*_ in ring:
                point=(round(x*SCALE),round(y*SCALE))
                if point==last and values:continue
                values.extend([point[0]-last[0],point[1]-last[1]]);last=point
            if len(values)>=8:rings.append(values)
        if rings:result.append(rings)
    return result

def load_meta():
    rows={}
    for level in ('ADM1','ADM2'):
        path=download(f'https://www.geoboundaries.org/api/current/gbOpen/ALL/{level}/',CACHE/f'ALL-{level}-meta.json')
        for meta in read(path):
            # This provider's CHN ADM2 is explicitly "County Level", not
            # prefectures. Keeping it would duplicate counties as fake cities.
            if meta['boundaryISO']=='CHN' and level=='ADM2':continue
            rows[(meta['boundaryISO'],meta['boundaryType'])]=meta
    for country,level in EXTRA_LEVELS:
        path=CACHE/f'{country}-{level}-meta.json'
        try:
            download(f'https://www.geoboundaries.org/api/current/gbOpen/{country}/{level}/',path)
            meta=read(path)
            if isinstance(meta,dict) and meta.get('boundaryISO'):rows[(country,level)]=meta
        except Exception as exc:print('Extra layer unavailable',country,level,str(exc),flush=True)
    # Preserve all previously pinned layers, names and stable shape IDs.
    for path in CACHE.glob('???-ADM?-meta.json'):
        meta=read(path)
        if isinstance(meta,dict) and meta.get('boundaryISO'):
            key=(meta['boundaryISO'],meta['boundaryType'])
            if key in rows:rows[key]=meta
    # The committed index pins each released source URL, including its Git
    # revision, so a fresh clone does not silently switch to today's boundary.
    released=read(ROOT/'src/data/world-geography-index.json')
    for source in released.get('sources',[]):
        if source.get('provider')!='geoBoundaries' or '-' not in source['id']:continue
        country,level=source['id'].split('-',1);key=(country,level)
        if key not in rows:continue
        rows[key]={**rows[key],'simplifiedGeometryGeoJSON':source['url'],'boundaryYearRepresented':source['year'],'boundaryLicense':source['license'],'boundarySource':source.get('source','geoBoundaries'),'admUnitCount':str(source.get('reportedCount',source['count']))}
    return rows

def fetch_layer(item):
    (country,level),meta=item
    name=f'{country}-{level}'
    path=CACHE/f'{name}.geojson'
    url=meta['simplifiedGeometryGeoJSON'].replace('https://github.com/wmgeolab/geoBoundaries/raw/','https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/')
    try:
        download(url,path)
        write(CACHE/f'{name}-meta.json',meta)
        return name,meta,None
    except Exception as exc:return name,meta,str(exc)

def role(country,level):
    if country=='CHN':return {'ADM1':'province','ADM2':'city','ADM3':'county'}[level]
    if country=='TWN':return 'city' if level=='ADM1' else 'county'
    if country=='JPN':return 'province' if level=='ADM1' else 'city'
    if country in ('PHL','MMR'):return {'ADM1':'province','ADM2':'city','ADM3':'county'}.get(level,'county')
    if level=='ADM1' and country in {'AND','ATG','BRB','DMA','GRD','KNA','LIE','MLT','MNE','NIU','NRU','SMR','TTO','VCT'}:return 'county'
    return 'province' if level=='ADM1' else 'county'

def geographic_region(country,point,info):
    """Map contexts for transcontinental countries use the locality, not capital.

    These are regional navigation classifications, not administrative borders.
    A unit spanning a continental boundary uses its interior representative point.
    """
    x,y=point.x,point.y
    if country=='RUS' and x>=60:return 'Asia','Northern Asia'
    if country=='TUR' and x<29 and y>40:return 'Europe','Southern Europe'
    if country=='KAZ' and x<52 and y>46:return 'Europe','Eastern Europe'
    if country=='EGY' and x>32.5 and y>27.5:return 'Asia','Western Asia'
    if country=='IDN' and x>=130:return 'Oceania','Melanesia'
    if country=='FRA' and x<-30 and y<10:return 'South America','South America'
    return info['ct'],info['sr']

def level_label(country,level,meta):
    known={('CHN','ADM1'):'省级地区',('CHN','ADM2'):'地级地区',('CHN','ADM3'):'县、市、区',('JPN','ADM1'):'都道府县',('JPN','ADM2'):'市町村等地方单位',('TWN','ADM1'):'县、市',('TWN','ADM2'):'乡镇、市、区',('PHL','ADM3'):'市、自治市',('MMR','ADM3'):'镇区'}
    if (country,level) in known:return known[(country,level)]
    canonical=meta.get('boundaryCanonical','')
    return canonical if canonical and canonical.lower() not in ('unknown','none') else ('一级行政区' if level=='ADM1' else '二级行政区')

def joined_bounds(rows):
    return [min(r['b'][0] for r in rows),min(r['b'][1] for r in rows),max(r['b'][2] for r in rows),max(r['b'][3] for r in rows)]

def local_admin_names(country,level):
    config={('CHN','ADM2'):('CN',{'ADM2'}),('JPN','ADM1'):('JP',{'ADM1'}),('TWN','ADM1'):('TW',{'ADM1','ADM2'})}
    if (country,level) not in config:return [],None
    cc,levels=config[(country,level)];path=download(f'https://download.geonames.org/export/dump/{cc}.zip',CACHE/f'{cc}.zip')
    with zipfile.ZipFile(path) as archive:rows=[line.split('\t') for line in archive.read(cc+'.txt').decode().splitlines()]
    result=[]
    for row in rows:
        if row[7] not in levels:continue
        variants=list(dict.fromkeys([row[1],row[2]]+row[3].split(',')))
        native=[name for name in variants if re.fullmatch(r'[\u3400-\u9fff\u3040-\u30ff]+',name)]
        preferred=sorted([name for name in native if re.search(r'[市県縣县省都道府州盟區区]$',name)] or native,key=len,reverse=True)
        if not preferred:continue
        result.append({'name':preferred[0],'aliases':native,'norms':{OLD.normal(name) for name in variants if OLD.normal(name)},'point':Point(float(row[5]),float(row[4])),'g':row[0]})
    return result,STRtree([row['point'] for row in result]) if result else None

def chinese_prefectures(counties,province_rows,country_info):
    """Union only counties with a verified GeoNames administrative parent.

    These are partial-coverage geographical aggregates, not newly drawn lines.
    A county without an identified parent keeps the known province parent.
    """
    with zipfile.ZipFile(CACHE/'CN.zip') as archive:records=[line.split('\t') for line in archive.read('CN.txt').decode().splitlines()]
    records_by_id={row[0]:row for row in records}
    parents={(row[10],row[11]):row for row in records if row[7]=='ADM2'}
    grouped=defaultdict(list)
    for row,geom in counties:
        if row['c']!='CHN':continue
        record=records_by_id.get(row.get('g'))
        if record and (record[10],record[11]) in parents:grouped[parents[(record[10],record[11])][0]].append((row,geom,parents[(record[10],record[11])]))
    result=[]
    for gid,children in sorted(grouped.items()):
        record=children[0][2];variants=list(dict.fromkeys([record[1],record[2]]+record[3].split(',')))
        native=[name for name in variants if re.fullmatch(r'[\u3400-\u9fff]+',name)]
        preferred=sorted([name for name in native if name.endswith(('市','州','盟','地区'))] or native,key=len,reverse=True)
        name=preferred[0] if preferred else record[1]
        geom=unary_union([child[1] for child in children]);point=geom.representative_point()
        known_parents=[parent for parent,shape_ in province_rows if shape_.covers(point)]
        if not known_parents:continue
        parent=known_parents[0]
        if parent['n'] in ('北京','天津','上海','重庆'):
            for child,_,_ in children:child['pi']=parent['id'];child['p']=parent['n']
            continue
        uid='prefecture:CN:'+gid
        row={'id':uid,'n':name,'c':'CHN','r':'china','l':'CHN-PREFECTURE','z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds],'h':'city','ct':country_info['ct'],'sr':country_info['sr'],'f':'CHN-PREFECTURE','pi':parent['id'],'p':parent['n'],'g':gid,'a':list(dict.fromkeys([record[1]]+native)),'partial':True}
        for child,_,_ in children:child['pi']=uid;child['p']=name
        result.append((row,geom))
    return result

def main():
    legacy_path=CACHE/'legacy-index-v111.json'
    if not legacy_path.exists():legacy_path.write_bytes((ROOT/'src/data/world-geography-index.json').read_bytes())
    legacy=read(legacy_path)
    legacy_by_id={row['id']:row for row in legacy['units']}
    legacy_country={row['c']:row for row in legacy['units'] if row['id'].startswith('country:')}
    world_path=download(WORLD_URL,CACHE/'world-10m.geojson')
    world=read(world_path)
    hk_path=download(HK_URL,CACHE/'HKG-official.json');hk_official=read(hk_path);hk_names={f['properties']['District'] for f in hk_official['features']}
    metadata=load_meta()
    print('Metadata:',len(metadata),'layers',flush=True)
    loaded={};failures=[]
    with futures.ThreadPoolExecutor(max_workers=10) as pool:
        for number,(name,meta,error) in enumerate(pool.map(fetch_layer,metadata.items()),1):
            if error:failures.append({'id':name,'error':error})
            else:loaded[name]=meta
            if number%20==0 or error:print('Download',number,'/',len(metadata),'failures',len(failures),flush=True)
    units=[];unit_by_id={};country_info={};country_crosswalk={};country_shapes={};world_geometry={};layers=[];sources=[];unmatched=[]
    for feature in world['features']:
        props=feature['properties'];country=props['ADM0_A3'];uid='country:'+country
        if uid in unit_by_id:continue
        geom=shape(feature['geometry']);point=geom.representative_point()
        row={'id':uid,'n':props.get('NAME_ZH') or props['NAME'],'c':country,'r':REGIONS.get(country,country.lower()),'l':'world','z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds],'h':'country','ct':props['CONTINENT'],'sr':props['SUBREGION'],'f':'world'}
        label_point=Point(props.get('LABEL_X',point.x),props.get('LABEL_Y',point.y))
        if geom.covers(label_point):row['z']=[round(label_point.x,4),round(label_point.y,4)]
        aliases=list(dict.fromkeys([props['NAME'],props['ADMIN']]+legacy_by_id.get(uid,{}).get('a',[])))
        if country=='TWN':aliases+=['台湾','中国台湾','台灣','中國台灣']
        if aliases:row['a']=aliases
        units.append(row);unit_by_id[uid]=row;country_info[country]=row;country_shapes[country]=geom
        world_geometry[uid]=encode(geom,.006)
        for code in [country,props.get('ISO_A3'),props.get('ISO_A3_EH')]:
            if code and code!='-99':country_crosswalk[code]=country
    # Minor disputed features reuse their sovereign's ISO code. They must never
    # redirect France/Brazil/Australia/Kazakhstan to an offshore feature.
    for country in country_info:country_crosswalk[country]=country
    country_crosswalk.update({'XKX':'KOS','ESH':'SAH'})
    by_country=defaultdict(list)
    for name,meta in loaded.items():by_country[meta['boundaryISO']].append((name,meta))
    # Natural Earth includes dependencies and microstates. geoBoundaries may
    # represent an additional dependency separately; union its real ADM1 shapes.
    for iso,entries in sorted(by_country.items()):
        canonical=country_crosswalk.get(iso,iso)
        if canonical in country_info:continue
        name,meta=sorted(entries)[0];data=read(CACHE/f'{name}.geojson')
        geom=unary_union([shape(f['geometry']) for f in data['features']]);point=geom.representative_point()
        ct=meta.get('Continent') or 'Seven seas (open ocean)';sr=meta.get('UNSDG-subregion') or ct
        row={'id':'country:'+canonical,'n':meta['boundaryName'],'c':canonical,'r':REGIONS.get(canonical,canonical.lower()),'l':'world','z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds],'h':'country','ct':ct,'sr':sr,'f':'world'}
        units.append(row);unit_by_id[row['id']]=row;country_info[canonical]=row;country_crosswalk[iso]=canonical;country_shapes[canonical]=geom;world_geometry[row['id']]=encode(geom,.006)
    for iso,entries in sorted(by_country.items()):
        country=country_crosswalk.get(iso,iso);info=country_info[country];previous=[];previous_tree=None;province_rows=[];extra_local=defaultdict(list)
        for layer_id,meta in sorted(entries,key=lambda entry:entry[1]['boundaryType']):
            level=meta['boundaryType'];data=read(CACHE/f'{layer_id}.geojson');new=[];geometry={};layer_units=[]
            local_names,names_tree=local_admin_names(iso,level)
            for feature in data['features']:
                props=feature['properties'];geom=shape(feature['geometry'])
                if geom.is_empty:continue
                if not geom.is_valid:geom=geom.buffer(0)
                if geom.geom_type not in ('Polygon','MultiPolygon'):continue
                point=geom.representative_point();original=props.get('shapeName') or '未命名行政单位';uid=iso+'-'+props['shapeID']
                # Existing province IDs are public saved-game identifiers.
                if iso=='CHN' and level=='ADM1':
                    if original.startswith(('Hong Kong','Macau','Taiwan')):continue
                    native=next((label for prefix,label in OLD.PROVINCES.items() if original.startswith(prefix)),None)
                    if native:uid='province:'+native
                old=legacy_by_id.get(uid,{})
                row={k:v for k,v in old.items() if k in {'id','n','a','g','p'}}
                row.update({'id':uid,'n':row.get('n',original),'c':country,'r':REGIONS.get(country,country.lower()),'l':layer_id,'z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds],'h':role(iso,level),'ct':info['ct'],'sr':info['sr'],'f':layer_id})
                row['ct'],row['sr']=geographic_region(country,point,info)
                if names_tree is not None:
                    candidates=[local_names[int(i)] for i in names_tree.query(geom) if geom.covers(local_names[int(i)]['point'])]
                    exact=[candidate for candidate in candidates if OLD.normal(original) in candidate['norms']]
                    chosen=exact[0] if len(exact)==1 or exact and len({item['name'] for item in exact})==1 else candidates[0] if len(candidates)==1 else None
                    if chosen:
                        row['n']=chosen['name'];row['g']=chosen['g'];row['a']=list(dict.fromkeys([original]+chosen['aliases']))
                row['pi']=info['id']
                # v1.11's CHN source also contained Hong Kong districts and
                # Macau local units. Keep their stable IDs, correct jurisdiction.
                local_country=('HKG' if original in hk_names else 'MAC' if original=='Macau' or 'São Francisco Xavier' in original or 'Nossa Senhora do Carmo' in original or 'Zona de Aterro' in original else None) if iso=='CHN' and level=='ADM3' else None
                if local_country:
                    local=country_info[local_country];row.update({'c':local_country,'r':REGIONS[local_country],'pi':local['id'],'p':local['n'],'f':local_country+'-local','ct':local['ct'],'sr':local['sr']})
                if previous_tree is not None and not local_country:
                    candidates=[previous[int(i)] for i in previous_tree.query(point) if previous[int(i)][1].covers(point)]
                    if not candidates:
                        nearby=[previous[int(i)] for i in previous_tree.query(geom)]
                        if nearby:
                            candidate=max(nearby,key=lambda r:geom.intersection(r[1]).area)
                            if geom.intersection(candidate[1]).area/max(geom.area,1e-12)>.45:candidates=[candidate]
                    if candidates:
                        parent=min(candidates,key=lambda r:r[1].area)[0];row['pi']=parent['id'];row['p']=parent['n']
                    else:unmatched.append({'id':uid,'level':layer_id,'parent':info['id']})
                units.append(row);unit_by_id[uid]=row;new.append((row,geom))
                if local_country:extra_local[local_country].append((row,geom))
                else:layer_units.append(row);geometry[uid]=encode(geom)
            if iso=='CHN' and level=='ADM1':province_rows=new
            if iso=='CHN' and level=='ADM3':
                prefectures=chinese_prefectures(new,province_rows,info)
                for row,_ in prefectures:units.append(row);unit_by_id[row['id']]=row
                pref_path=OUT/'CHN-PREFECTURE-boundaries.json';write(pref_path,{'version':2,'scale':SCALE,'features':{row['id']:encode(geom) for row,geom in prefectures}})
                layers.append({'id':'CHN-PREFECTURE','file':pref_path.name,'country':'CHN','level':'PREFECTURE','role':'city','count':len(prefectures),'bounds':joined_bounds([r for r,g in prefectures]),'bytes':pref_path.stat().st_size,'sha256':digest(pref_path),'derived':True,'partial':True})
                sources.append({'id':'CHN-PREFECTURE','provider':'geoBoundaries + GeoNames','year':'2017 borders / 2026 parent codes','level':'地级地区（已核实下属县界的集合）','count':len(prefectures),'license':'Open Database License 1.0; GeoNames CC BY 4.0','url':'https://download.geonames.org/export/dump/','derived':True,'partial':True,'method':'Union of CHN-ADM3 counties with matching GeoNames ADM2 parent code. Unidentified counties retain the province parent.'})
            path=OUT/f'{layer_id}-boundaries.json';write(path,{'version':2,'scale':SCALE,'features':geometry})
            source={'id':layer_id,'provider':'geoBoundaries','year':meta['boundaryYearRepresented'],'level':level_label(iso,level,meta),'count':len(new),'reportedCount':int(meta.get('admUnitCount') or 0),'license':meta['boundaryLicense'],'source':meta['boundarySource'],'url':meta['simplifiedGeometryGeoJSON'],'sha256':digest(CACHE/f'{layer_id}.geojson')}
            sources.append(source)
            layers.append({'id':layer_id,'file':path.name,'country':country,'level':level,'role':role(iso,level),'count':len(layer_units),'bounds':joined_bounds(layer_units),'bytes':path.stat().st_size,'sha256':digest(path)})
            previous=new;previous_tree=STRtree([r[1] for r in new]) if new else None
            print('Built',layer_id,len(layer_units),path.stat().st_size,flush=True)
        for local_country,local_rows in extra_local.items():
            local_id=local_country+'-local';path=OUT/f'{local_id}-boundaries.json'
            write(path,{'version':2,'scale':SCALE,'features':{row['id']:encode(geom) for row,geom in local_rows}})
            layers.append({'id':local_id,'file':path.name,'country':local_country,'level':'ADM1','role':'county','count':len(local_rows),'bounds':joined_bounds([r for r,g in local_rows]),'bytes':path.stat().st_size,'sha256':digest(path)})
    # Hong Kong's official open-data geometry supplies all 18 districts. Reuse
    # the ten legacy IDs where those districts were already present in 1.11.
    hk_rows=[];hk_geometry={};hk_info=country_info['HKG']
    for feature in hk_official['features']:
        props=feature['properties'];english=props['District'];geom=shape(feature['geometry']);point=geom.representative_point()
        row=next((row for row in units if row['c']=='HKG' and english in [row['n']]+row.get('a',[])),None)
        if row is None:
            row={'id':'HKG-district:'+props['地區號碼']};units.append(row);unit_by_id[row['id']]=row
        row.update({'n':props['地區'],'a':[english],'c':'HKG','r':'hongkong','l':'HKG-OFFICIAL','f':'HKG-local','h':'county','ct':'Asia','sr':'Eastern Asia','pi':'country:HKG','p':hk_info['n'],'z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds]})
        hk_rows.append(row);hk_geometry[row['id']]=encode(geom,.0005)
    hk_output=OUT/'HKG-local-boundaries.json';write(hk_output,{'version':2,'scale':SCALE,'features':hk_geometry})
    hk_layer=next(layer for layer in layers if layer['id']=='HKG-local');hk_layer.update({'count':18,'bounds':joined_bounds(hk_rows),'bytes':hk_output.stat().st_size,'sha256':digest(hk_output)})
    sources.append({'id':'HKG-OFFICIAL','provider':'Hong Kong Home Affairs Department','year':'2026-09-12','level':'18区','count':18,'license':'DATA.GOV.HK Terms and Conditions (free reuse with attribution)','url':HK_URL,'sha256':digest(hk_path)})
    # Keep older saved IDs even if a provider revised an unrelated feature.
    missing_legacy=[row for row in legacy['units'] if row['id'] not in unit_by_id]
    if missing_legacy:raise RuntimeError('Legacy IDs missing: '+str([r['id'] for r in missing_legacy]))
    world_output=OUT/'world-boundaries.json';write(world_output,{'version':2,'scale':SCALE,'features':world_geometry})
    layers.insert(0,{'id':'world','file':world_output.name,'country':None,'level':'ADM0','role':'country','count':len(world_geometry),'bounds':[-180,-90,180,90],'bytes':world_output.stat().st_size,'sha256':digest(world_output)})
    sources.insert(0,{'id':'world','provider':'Natural Earth','year':'5.1.2','level':'国家与地区，1:10m','count':len(world_geometry),'license':'Public domain','url':WORLD_URL,'sha256':digest(world_path)})
    sources.append(next(s for s in legacy['sources'] if s['id']=='names'))
    coverage=[]
    for country,info in sorted(country_info.items()):
        available=[layer for layer in layers if layer['country']==country];levels=[layer['level'] for layer in available]
        finest=max((level for level in levels if level.startswith('ADM')),default='ADM0')
        note='按实际行政体系显示已知层级。'
        if finest=='ADM0':note='此资料集没有可用的地方行政界线；只显示国家或地区边界。'
        elif finest=='ADM1':note='目前收录一级行政区；部分小国该级已为最基层，不把不存在的中层补成虚构县市。'
        coverage.append({'country':country,'name':info['n'],'availableLevels':['ADM0']+levels,'finestLevel':finest,'finestCount':next((layer['count'] for layer in available if layer['level']==finest),1),'missingLevels':[level for level in ('ADM1','ADM2') if level not in levels],'note':note})
    # Discard provisional misses resolved by known administrative parent codes.
    unmatched=[row for row in unmatched if unit_by_id[row['id']].get('pi')==row['parent']]
    groups={}
    for key,labels in [('continents',CONTINENTS),('subregions',SUBREGIONS)]:
        field='ct' if key=='continents' else 'sr';members=defaultdict(list)
        for info in country_info.values():members[info[field]].append(info)
        for unit in units:
            if unit[field]!=country_info[unit['c']][field]:members[unit[field]].append(unit)
        groups[key]={name:{'name':labels.get(name,name),'bounds':joined_bounds(rows),'countries':sorted(row['c'] for row in rows)} for name,rows in sorted(members.items())}
        for group in groups[key].values():group['countries']=sorted(set(group['countries']))
    manifest={'version':2,'scale':SCALE,'generatedAt':'2026-10-26','layers':layers,'coverage':coverage,**groups,'unmatchedParents':unmatched,'downloadFailures':failures,'note':'行政区来自各来源注明年份；各国行政体系不同，不保证每地均存在省、市、县三级。'}
    write(OUT/'manifest.json',manifest)
    write(OUT/'sources.json',{'sources':sources,'coverage':coverage,'unmatchedParents':unmatched,'note':manifest['note']})
    index={'version':2,'scale':SCALE,'units':units,'sources':sources}
    write(ROOT/'src/data/world-geography-index.json',index)
    # These two generated v1.11/first-pass assets are superseded by shards.
    # Never enumerate and delete arbitrary files in the output directory.
    for obsolete in ('asia-boundaries.json','CHN-ADM2-boundaries.json'):
        path=(OUT/obsolete).resolve()
        if path.parent==OUT.resolve() and path.exists():path.unlink()
    print('RESULT',json.dumps({'countries':len(country_info),'units':len(units),'layers':len(layers),'geometryBytes':sum(layer['bytes'] for layer in layers),'indexBytes':(ROOT/'src/data/world-geography-index.json').stat().st_size,'unmatchedParents':len(unmatched),'failedDownloads':failures},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
