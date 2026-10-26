"""Build the offline atlas. Python 3 + shapely; downloaded sources stay in .cache.

The geometry is geographic data, never inferred from MOD province pixels. Each
layer retains its own source licence; generated data is separate from game code.
"""
from pathlib import Path
import concurrent.futures, hashlib, json, re, unicodedata, urllib.request, zipfile
from shapely.geometry import shape, mapping, Point
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'geography'
OUT = ROOT / 'public' / 'maps'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
LAYERS = [('CHN','ADM3'),('JPN','ADM2'),('TWN','ADM2'),('KOR','ADM2'),('PRK','ADM2'),('MNG','ADM2'),('VNM','ADM2'),('THA','ADM2'),('IND','ADM2'),('PAK','ADM2'),('MMR','ADM2'),('IDN','ADM2'),('PHL','ADM2'),('CHN','ADM1')]
LEVELS = {'CHN':'县、市、区','JPN':'市町村等地方单位','TWN':'乡镇、市、区','KOR':'市、郡、区','PRK':'市、郡','MNG':'苏木、区','VNM':'县、郡、县级市','THA':'县、区','IND':'县','PAK':'县','MMR':'专区','IDN':'县、市','PHL':'省及独立城市'}
REGIONS = {'CHN':'china','JPN':'japan','TWN':'taiwan','KOR':'korea','HKG':'hongkong','MAC':'macau'}
PROVINCES = dict(zip(['Hainan','Guangxi','Fujian','Yunnan','Guizhou','Jiangxi','Hunan','Zhejiang','Shanghai','Chongqing','Hubei','Sichuan','Anhui','Jiangsu','Henan','Tibet','Shandong','Qinghai','Ningxia','Shaanxi','Tianjin','Shanxi','Beijing','Gansu','Hebei','Liaoning','Jilin','Xinjiang','Inner Mongolia','Heilongjiang','Guangzhou'],['海南','广西','福建','云南','贵州','江西','湖南','浙江','上海','重庆','湖北','四川','安徽','江苏','河南','西藏','山东','青海','宁夏','陕西','天津','山西','北京','甘肃','河北','辽宁','吉林','新疆','内蒙古','黑龙江','广东']))

def download(url, dest):
    if not dest.exists():
        request = urllib.request.Request(url, headers={'User-Agent':'MaoLegacyLife-atlas-build/1.0'})
        dest.write_bytes(urllib.request.urlopen(request, timeout=90).read())
    return dest

def layer(pair):
    country, adm = pair
    name = country+'-'+adm
    meta = json.loads(download(f'https://www.geoboundaries.org/api/current/gbOpen/{country}/{adm}/',CACHE/(name+'-meta.json')).read_text(encoding='utf-8'))
    url = meta['simplifiedGeometryGeoJSON'].replace('https://github.com/wmgeolab/geoBoundaries/raw/','https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/')
    path = download(url,CACHE/(name+'.geojson'))
    data = json.loads(path.read_text(encoding='utf-8'))
    meta['actualFeatureCount'] = len(data['features'])
    meta['downloadSha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    return name, data, meta

def normal(text):
    return re.sub(r'[^a-z0-9]','',re.sub(r'\b(county|city|district|township|province|shi|xian|qu|shi|mura|cho|chou|ku|gun|si|gu)\b','',unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()))

def names(country):
    cc = {'CHN':'CN','JPN':'JP','TWN':'TW','KOR':'KR'}.get(country)
    if not cc: return [], None
    path = download(f'https://download.geonames.org/export/dump/{cc}.zip', CACHE/(cc+'.zip'))
    with zipfile.ZipFile(path) as archive:
        rows = [line.split('\t') for line in archive.read(cc+'.txt').decode().splitlines()]
    levels = {'CN':{'ADM3','ADM3H'},'TW':{'ADM3'},'JP':{'ADM2','ADM3','ADMD'},'KR':{'ADM2'}}[cc]
    parents={}
    for row in rows:
        if row[7] not in {'ADM1','ADM2'}:continue
        native=[n for n in [row[1]]+row[3].split(',') if re.fullmatch(r'[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+',n)]
        native=sorted([n for n in native if re.search(r'[市県縣县省都道府郡區区시도군]$',n)] or native,key=len,reverse=True)
        parents[(row[7],row[10],row[11] if row[7]=='ADM2' else '')]=native[0] if native else row[1]
    result = []
    for row in rows:
        if row[7] not in levels: continue
        variants = list(dict.fromkeys([row[1],row[2]]+row[3].split(',')))
        native = [n for n in variants if re.fullmatch(r'[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+',n)]
        suffix = {'CN':r'[县區区市旗]$','TW':r'[區区鄉乡鎮镇市]$','JP':r'[市区町村]$','KR':r'[군시구]$'}[cc]
        preferred = sorted([n for n in native if re.search(suffix,n)],key=len,reverse=True)
        if not preferred: preferred = sorted(native,key=len,reverse=True)
        if not preferred: continue
        parent_key=('ADM2',row[10],row[11]) if cc=='TW' else ('ADM1',row[10],'')
        result.append({'name':preferred[0],'aliases':native,'norms':{normal(n) for n in variants if normal(n)},'point':Point(float(row[5]),float(row[4])),'id':row[0],'parent':parents.get(parent_key,'')})
    return result, STRtree([r['point'] for r in result])

def encode(geom):
    # Retain islands, holes and valid rings while reducing mobile rendering cost.
    geom = geom.simplify(0.0025, preserve_topology=True)
    coordinates = mapping(geom)['coordinates']
    if geom.geom_type == 'Polygon': coordinates = [coordinates]
    result = []
    for poly in coordinates:
        rings=[]
        for ring in poly:
            values=[]; last=(0,0)
            for x,y,*_ in ring:
                p=(round(x*10000),round(y*10000))
                if p==last and values: continue
                values.extend([p[0]-last[0],p[1]-last[1]]);last=p
            if len(values)>=8:rings.append(values)
        if rings: result.append(rings)
    return result

def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def main():
    loaded = dict((name,(data,meta)) for name,data,meta in concurrent.futures.ThreadPoolExecutor(6).map(layer,LAYERS))
    province_shapes=[]
    for f in loaded['CHN-ADM1'][0]['features']:
        name = f['properties']['shapeName']
        for prefix,label in PROVINCES.items():
            if name.startswith(prefix):province_shapes.append((label,shape(f['geometry'])));break
    units=[]; geometries={}; sources=[]; name_count={}
    for country,adm in LAYERS:
        if adm=='ADM1':continue
        data,meta=loaded[country+'-'+adm]
        source_id=country+'-'+adm
        sources.append({'id':source_id,'provider':'geoBoundaries','year':meta['boundaryYearRepresented'],'level':LEVELS[country],'reportedCount':int(meta['admUnitCount']),'count':len(data['features']),'license':meta['boundaryLicense'],'source':meta['boundarySource'],'url':meta['simplifiedGeometryGeoJSON'],'sha256':meta['downloadSha256']})
        labels,tree=names(country);name_count[country]=0
        for f in data['features']:
            props=f['properties'];geom=shape(f['geometry']);point=geom.representative_point();original=props.get('shapeName') or ('未命名地方单位 '+str(props['shapeID'])[-5:]);name=original;aliases=[];geo_id=None
            chosen=None
            if tree is not None:
                candidates=[labels[int(i)] for i in tree.query(geom) if geom.covers(labels[int(i)]['point'])]
                exact=[r for r in candidates if normal(original) in r['norms']]
                # Never attach an unrelated locality merely because it is nearby.
                chosen=exact[0] if len(exact)==1 else candidates[0] if len(candidates)==1 else None
                if chosen:
                    name=chosen['name'];aliases=chosen['aliases'];geo_id=chosen['id'];name_count[country]+=1
            parent=next((n for n,g in province_shapes if g.covers(point)),'') if country=='CHN' else chosen['parent'] if chosen else ''
            uid=country+'-'+props['shapeID']
            row={'id':uid,'n':name,'c':country,'r':REGIONS.get(country,country.lower()),'l':source_id,'z':[round(point.x,4),round(point.y,4)],'b':[round(v,4) for v in geom.bounds]}
            if parent:row['p']=parent
            if name!=original:row['a']=list(dict.fromkeys([original]+aliases))
            if geo_id:row['g']=geo_id
            units.append(row);geometries[uid]=encode(geom)
        print(source_id,len(data['features']),'native labels',name_count[country])
    # Hong Kong and Macau retain their own administration. This source only
    # supports the territory outline; it is not labelled as district coverage.
    for f in loaded['CHN-ADM1'][0]['features']:
        raw=f['properties']['shapeName']
        country='HKG' if raw.startswith('Hong Kong') else 'MAC' if raw.startswith('Macau') else None
        if not country:continue
        geom=shape(f['geometry']);p=geom.representative_point();uid='country:'+country
        units.append({'id':uid,'n':'香港' if country=='HKG' else '澳门','c':country,'r':REGIONS[country],'l':'CHN-ADM1','z':[round(p.x,4),round(p.y,4)],'b':[round(v,4) for v in geom.bounds]})
        geometries[uid]=encode(geom)
    chnmeta=loaded['CHN-ADM1'][1]
    for name,geom in province_shapes:
        p=geom.representative_point();uid='province:'+name
        units.append({'id':uid,'n':name,'c':'CHN','r':'china','l':'CHN-ADM1','z':[round(p.x,4),round(p.y,4)],'b':[round(v,4) for v in geom.bounds]})
        geometries[uid]=encode(geom)
    sources.append({'id':'CHN-ADM1','provider':'geoBoundaries','year':chnmeta['boundaryYearRepresented'],'level':'省级地区','count':33,'license':chnmeta['boundaryLicense'],'source':chnmeta['boundarySource'],'url':chnmeta['simplifiedGeometryGeoJSON'],'sha256':chnmeta['downloadSha256']})
    world_url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    world_path=download(world_url,CACHE/'world.geojson');world=json.loads(world_path.read_text(encoding='utf-8'));world_geometries={}
    for f in world['features']:
        p=f['properties'];country=p.get('ADM0_A3') or p['SOV_A3'];uid='country:'+country
        if any(u['id']==uid for u in units):continue
        geom=shape(f['geometry']);center=geom.representative_point()
        units.append({'id':uid,'n':p.get('NAME_ZH') or p['NAME'],'a':list(dict.fromkeys([p['NAME'],p['ADMIN']])),'c':country,'r':REGIONS.get(country,country.lower()),'l':'world','z':[round(center.x,4),round(center.y,4)],'b':[round(v,4) for v in geom.bounds]})
        world_geometries[uid]=encode(geom)
    sources.append({'id':'world','provider':'Natural Earth','year':'5.1.1','level':'国家与地区，1:110m','count':len(world_geometries),'license':'Public domain','url':world_url,'sha256':hashlib.sha256(world_path.read_bytes()).hexdigest()})
    sources.append({'id':'names','provider':'GeoNames','year':'downloaded 2026-10-26','level':'行政单位本地名称（仅做名称配对，不改变边界）','count':sum(name_count.values()),'license':'Creative Commons Attribution 4.0','url':'https://download.geonames.org/export/dump/'})
    index={'version':1,'scale':10000,'units':units,'sources':sources}
    write(ROOT/'src/data/world-geography-index.json',index)
    write(OUT/'asia-boundaries.json',{'version':1,'scale':10000,'features':geometries})
    write(OUT/'world-boundaries.json',{'version':1,'scale':10000,'features':world_geometries})
    write(OUT/'sources.json',{'sources':sources,'nativeNameMatches':name_count,'note':'行政边界为来源年份的示意图；颜色为当前故事中的实际管治，不表达领土主张。亚洲不同国家使用其实际行政层级，未全部称为县。'})
    print('units',len(units),'geometry bytes',sum(p.stat().st_size for p in OUT.glob('*.json')))

if __name__=='__main__':main()

