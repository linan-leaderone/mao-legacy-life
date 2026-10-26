"""Project the MOD's *resolved* opening control onto real administrative units.

Run build-country-catalog.mjs first. Its ordered history/startup interpreter owns
the political facts; this script never reinterprets an owner as a controller.
Real county geometry remains unchanged. Georeferenced game cells are evidence
for control, not administrative borders. Mixed/uncertain projections stay so.

Build dependencies: Python 3, numpy, Pillow, shapely. GeoNames cities15000 is
cached privately; only used reference coordinates and attribution are exported.
"""
from pathlib import Path
from collections import Counter, defaultdict
import argparse, hashlib, json, math, re, unicodedata, urllib.request, zipfile
import numpy as np
from PIL import Image
from shapely.geometry import Point, Polygon, MultiPolygon

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--mod', default=str(ROOT.parent / 'TFR-xinzuo-rebuild'))
args = parser.parse_args()
MOD = Path(args.mod)
CACHE = ROOT / '.cache/geography'
CACHE.mkdir(parents=True, exist_ok=True)
CATALOG = json.loads((ROOT / 'src/data/countries.json').read_text(encoding='utf-8'))
ATLAS = json.loads((ROOT / 'src/data/world-geography-index.json').read_text(encoding='utf-8'))
UNITS = {u['id']: u for u in ATLAS['units']}
TAGS = CATALOG['tags']
STATES = {s['id']: s for s in CATALOG.get('openingStates', [])}
if not STATES:
    raise SystemExit('Build the v1.13 resolved country catalog first (openingStates missing).')
WARS = CATALOG.get('openingWars', [])
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
norm = lambda s: re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())
ISO2 = {'AFG':'AF', 'SYR':'SY', 'YEM':'YE', 'UKR':'UA', 'LBY':'LY', 'SOM':'SO',
        'IRQ':'IQ', 'GEO':'GE', 'MDA':'MD', 'MMR':'MM', 'CYP':'CY', 'ESH':'EH',
        'AZE':'AZ', 'LBN':'LB', 'CAF':'CF', 'BEL':'BE'}
COUNTRY_TAGS = defaultdict(set)
for tag, row in TAGS.items():
    if row.get('iso') and (row.get('controlledStateIds') or row.get('ownedStateIds')):
        COUNTRY_TAGS[row['iso']].add(tag)
# A transferred state can belong to a TAG whose original homeland is elsewhere.
EXTERNAL_TAGS = {'UKR': {'SOV','BYA'}, 'SYR': {'TUR','ISR'}, 'CYP': {'TUR'}, 'ESH': {'MOR'}}
EXTERNAL_STATES = {'UKR': {137,1374}, 'SYR': {1030,1035,881}, 'CYP': {836}, 'ESH': {699,882}}
source_files = []
for relative in ['map/definition.csv', 'map/provinces.bmp', 'map/unitstacks.txt']:
    p = MOD / relative
    source_files.append({'path': relative, 'sha256': digest(p)})

def geonames():
    cache = CACHE / 'cities15000.zip'
    if not cache.exists():
        req = urllib.request.Request('https://download.geonames.org/export/dump/cities15000.zip',
                                    headers={'User-Agent':'MaoLegacyLife-control-builder/1.13'})
        with urllib.request.urlopen(req, timeout=60) as response:
            cache.write_bytes(response.read())
    result = defaultdict(dict)
    with zipfile.ZipFile(cache) as z:
        for line in z.read('cities15000.txt').decode('utf-8').splitlines():
            a = line.split('\t')
            city = {'id':int(a[0]), 'name':a[1], 'coordinate':[float(a[5]),float(a[4])], 'population':int(a[14])}
            for name in [a[1],a[2],*a[3].split(',')]:
                key = norm(name)
                if len(key) > 2: result[(a[8],key)][city['id']] = city
    return result, digest(cache)

cities, cities_hash = geonames()
vp_names = {}
for p in sorted((MOD / 'localisation/english').glob('*victory_points*')):
    for m in re.finditer(r'VICTORY_POINTS_(\d+):\s*(?:\d+\s*)?"([^"\n]+)"', p.read_text(encoding='utf-8-sig')):
        vp_names[int(m[1])] = m[2]
positions = {}
for line in (MOD / 'map/unitstacks.txt').read_text(encoding='utf-8').splitlines():
    a = line.split(';')
    if len(a)>4 and a[1]=='0': positions[int(a[0])] = [float(a[2]),float(a[4])]
rgb_ids = {}
for line in (MOD / 'map/definition.csv').read_text(encoding='utf-8-sig',errors='replace').splitlines():
    a = line.split(';')
    if len(a)>4 and a[0].isdigit(): rgb_ids[int(a[1]) + (int(a[2])<<8) + (int(a[3])<<16)] = int(a[0])
image = np.asarray(Image.open(MOD / 'map/provinces.bmp').convert('RGB'), dtype=np.uint32)
packed = image[:,:,0] + (image[:,:,1]<<8) + (image[:,:,2]<<16)
height,width = packed.shape
province_state, province_tag = {}, {}
for sid, state in STATES.items():
    for pid in state['provinceIds']:
        province_state[pid] = sid
        province_tag[pid] = state.get('provinceControllers',{}).get(str(pid),state.get('controllerTag') or state.get('ownerTag'))

def decode_geometry(unit):
    layer = unit.get('f', 'world' if unit['l']=='world' else 'asia')
    if layer not in geometry_cache:
        p = ROOT / 'public/maps' / (layer+'-boundaries.json')
        geometry_cache[layer] = json.loads(p.read_text(encoding='utf-8')) if p.exists() else None
    bundle = geometry_cache[layer]
    if not bundle or unit['id'] not in bundle['features']: return None
    polygons = []
    for polygon in bundle['features'][unit['id']]:
        rings = []
        for ring in polygon:
            x=y=0; points=[]
            for i in range(0,len(ring),2):
                x+=ring[i]; y+=ring[i+1]; points.append((x/bundle['scale'],y/bundle['scale']))
            if len(points)>=3:rings.append(points)
        if rings:polygons.append(Polygon(rings[0],rings[1:]))
    return MultiPolygon(polygons) if polygons else None
geometry_cache = {}

def anchors_for(iso, allowed_states):
    ids = set()
    for state in STATES.values():
        if state['id'] not in allowed_states: continue
        # A province position is named by the MOD victory-point localisation;
        # its identity must be matched within the same geographic country.
        ids.update(state['provinceIds'])
    result = []
    for pid in sorted(ids):
        name = vp_names.get(pid,'')
        candidates = list(cities.get((ISO2[iso],norm(name)),{}).values()) if name else []
        if not candidates or pid not in positions: continue
        candidates.sort(key=lambda x:x['population'],reverse=True)
        if len(candidates)>1 and candidates[1]['population']>.4*candidates[0]['population']: continue
        city=candidates[0]
        result.append({'provinceId':pid,'name':name,'geonamesId':city['id'],'coordinate':city['coordinate'],'map':positions[pid]})
    return result

def fit(anchors):
    if len(anchors)<4:return None
    # Robust local affine fit rejects displaced/mislabeled victory points.
    use=anchors[:]
    for _ in range(5):
        x=np.array([[*a['coordinate'],1] for a in use]); y=np.array([a['map'] for a in use])
        coeff=np.linalg.lstsq(x,y,rcond=None)[0]
        errors=np.linalg.norm(x@coeff-y,axis=1)
        threshold=max(6.,float(np.median(errors))*2.5)
        keep=[a for a,e in zip(use,errors) if e<=threshold]
        if len(keep)<4 or len(keep)==len(use):break
        use=keep
    rms=float(np.mean(errors**2)**.5)
    return {'coefficient':coeff,'rms':rms,'anchors':use,'rejected':[a for a in anchors if a not in use]}

controls = {}
projections = {}
warnings = []
def point_samples(geometry, unit):
    if geometry is None:return [unit['z']]
    if not geometry.is_valid:geometry=geometry.buffer(0)
    if geometry.is_empty:return [unit['z']]
    minx,miny,maxx,maxy=geometry.bounds
    result=[]
    for x in np.linspace(minx,maxx,9):
        for y in np.linspace(miny,maxy,9):
            if geometry.covers(Point(x,y)):result.append([x,y])
    rp=geometry.representative_point();result.append([rp.x,rp.y])
    return result

for iso in ISO2:
    allowed=COUNTRY_TAGS[iso] | EXTERNAL_TAGS.get(iso,set())
    if len(allowed)<2:continue
    allowed_states={sid for sid,s in STATES.items() if s['ownerTag'] in COUNTRY_TAGS[iso]} | EXTERNAL_STATES.get(iso,set())
    projection=fit(anchors_for(iso,allowed_states))
    if not projection:
        warnings.append({'country':iso,'reason':'insufficient-reference-cities'});continue
    projections[iso]={'method':'local-affine-reference-cities','rmsPixels':round(projection['rms'],2),
                      'anchors':projection['anchors'],'rejectedAnchors':projection['rejected']}
    # Allowance samples expose uncertainty at contact lines and where the MOD
    # deliberately deforms geography. They are not a live battle indicator.
    error=max(2,min(18,math.ceil(projection['rms'])))
    for unit in ATLAS['units']:
        if unit['c']!=iso or unit.get('h')=='country':continue
        if unit.get('h')=='province':continue # aggregate actual county children below
        votes=Counter();state_votes=Counter();total=0
        for coordinate in point_samples(decode_geometry(unit),unit):
            xy=np.array([*coordinate,1])@projection['coefficient']
            for dx,dy in [(0,0),(-error,0),(error,0),(0,-error),(0,error)]:
                x=int(round(xy[0]+dx));y=height-1-int(round(xy[1]+dy));total+=1
                if not (0<=x<width and 0<=y<height):continue
                pid=rgb_ids.get(int(packed[y,x]));tag=province_tag.get(pid)
                if tag not in allowed or province_state.get(pid) not in allowed_states:continue
                votes[tag]+=1;state_votes[province_state[pid]]+=1
        if not votes:continue
        count=sum(votes.values()); shares=[{'tag':tag,'share':round(value/count,3)} for tag,value in votes.most_common()]
        important=[r for r in shares if r['share']>=.12]
        confident=count/max(1,total)>=.7 and shares[0]['share']>=.88 and projection['rms']<=9
        controls[unit['id']]={'tag':shares[0]['tag'] if confident else None,'dominantTag':shares[0]['tag'],
            'controllers':important or shares[:1],'uncertain':not confident,'mapping':'mod-raster-correspondence',
            'stateIds':[sid for sid,_ in state_votes.most_common(8)],'sampleCoverage':round(count/max(1,total),3)}

# Certain named geographic correspondences take priority over a map projection.
# These are the MOD's own opening control, never modern real-world war updates.
def named_override(iso, names, state_id):
    state=STATES[state_id];tag=state.get('controllerTag') or state['ownerTag']
    parents=[u for u in ATLAS['units'] if u['c']==iso and u.get('h')=='province' and u['n'] in names]
    parent_ids={u['id'] for u in parents}
    for unit in ATLAS['units']:
        if unit['c']!=iso:continue
        if unit['id'] in parent_ids or unit.get('pi') in parent_ids:
            controls[unit['id']]={'tag':tag,'dominantTag':tag,'controllers':[{'tag':tag,'share':1}],
                'uncertain':False,'mapping':'named-administrative-correspondence','stateIds':[state_id],'sampleCoverage':1}
named_override('UKR',{'Autonomous Republic of Crimea','Sevastopol'},137)
named_override('GEO',{'Abkhazia'},796)
named_override('CYP',{'Kyrenia'},836)

def partial_override(iso, names, state_ids):
    parts=sorted({STATES[sid].get('controllerTag') or STATES[sid]['ownerTag'] for sid in state_ids})
    parents={u['id'] for u in ATLAS['units'] if u['c']==iso and u['n'] in names}
    for unit in ATLAS['units']:
        if unit['c']==iso and (unit['id'] in parents or unit.get('pi') in parents):
            controls[unit['id']]={'tag':None,'dominantTag':None,'controllers':[{'tag':t,'share':None} for t in parts],
                'uncertain':True,'mapping':'named-divided-administrative-correspondence','stateIds':state_ids,'sampleCoverage':None}
# The European Quarter is smaller than the available Brussels boundary; neither
# Belgium nor the MOD's BRS actor receives exclusive control of the whole city.
partial_override('BEL',{'Brussels Hoofdstedelijk','Brussels'},[6,1490])
# Nicosia/Famagusta administrative boundaries cross the north/south divide.
# Their exact internal line cannot be inferred from a single named reference.
partial_override('CYP',{'Nicosia','Famagusta'},[183,836])
for unit in ATLAS['units']:
    if unit['c']=='CAF' and 'kagabandoro' in norm(unit['n']):
        state=STATES[779];tag=state.get('controllerTag') or state['ownerTag']
        controls[unit['id']]={'tag':tag,'dominantTag':tag,'controllers':[{'tag':tag,'share':1}],
            'uncertain':False,'mapping':'named-administrative-correspondence','stateIds':[779],'sampleCoverage':1}

# Map known city seats independently: the named MOD province is firmer evidence
# than a fitted pixel around a small capital district. The rest of its province
# may still be mixed. Never elevate a city point into control of an entire ADM1.
seat_bindings=[]
for iso, projection in projections.items():
    for anchor in projection['anchors']:
        point=Point(anchor['coordinate']);candidates=[]
        for unit in ATLAS['units']:
            if unit['c']!=iso or unit.get('h') in ('country','province'):continue
            geom=decode_geometry(unit)
            if geom and geom.covers(point):candidates.append(unit)
        if len(candidates)!=1:continue
        unit=candidates[0];pid=anchor['provinceId'];tag=province_tag.get(pid)
        if not tag:continue
        row=controls.get(unit['id'])
        if row and not row['uncertain'] and row['tag']!=tag:
            row['uncertain']=True;row['tag']=None
        # A city establishes an actual local presence; it cannot prove that all
        # territory in a large surrounding county belongs to the same actor.
        if row:
            if tag not in [c['tag'] for c in row['controllers']]:
                row['controllers'].append({'tag':tag,'share':None})
                row['tag']=None;row['uncertain']=True
            row['seatTag']=tag;row['seatName']=anchor['name'];row['seatProvinceId']=pid
            seat_bindings.append({'unitId':unit['id'],'tag':tag,'provinceId':pid,'geonamesId':anchor['geonamesId']})

children=defaultdict(list)
for unit in ATLAS['units']:
    if unit.get('pi'):children[unit['pi']].append(unit['id'])
for unit in ATLAS['units']:
    if unit.get('h')!='province' or unit['c'] not in projections:continue
    if controls.get(unit['id'],{}).get('mapping','').startswith('named-'):continue
    rows=[controls[i] for i in children[unit['id']] if i in controls]
    if not rows:continue
    votes=Counter()
    for row in rows:
        for item in row['controllers']:votes[item['tag']]+=item['share'] or .1
    total=sum(votes.values());parts=[{'tag':tag,'share':round(n/total,3)} for tag,n in votes.most_common()]
    mixed=len(parts)>1 or any(r['uncertain'] for r in rows)
    controls[unit['id']]={'tag':None if mixed else parts[0]['tag'],'dominantTag':parts[0]['tag'],
        'controllers':parts,'uncertain':mixed,'mapping':'administrative-children',
        'stateIds':sorted({sid for r in rows for sid in r['stateIds']}),'sampleCoverage':1}

defaults={}
for iso,row in CATALOG['countries'].items():
    if row.get('tag'):defaults[iso]=row['tag']
active_tags={s.get('controllerTag') or s.get('ownerTag') for s in STATES.values()}
active_tags.update(province_tag.values())
active_tags.discard(None)
factions=[]
for tag in sorted(active_tags):
    row=TAGS.get(tag)
    if not row:continue
    ids=[uid for uid,r in controls.items() if r['tag']==tag]
    possible=[uid for uid,r in controls.items() if r['tag']!=tag and tag in [c['tag'] for c in r['controllers']]]
    iso=row.get('iso')
    factions.append({'id':'faction:'+tag,'tag':tag,'name':row['name'],'country':iso,
        'controlledUnitIds':ids,'possibleUnitIds':possible,'primary':defaults.get(iso)==tag,
        'stateIds':sorted(sid for sid,s in STATES.items() if (s.get('controllerTag') or s.get('ownerTag'))==tag),
        'opponents':sorted({w['defenderTag'] if w['attackerTag']==tag else w['attackerTag'] for w in WARS if tag in (w['attackerTag'],w['defenderTag'])})})
needed_states={sid for r in controls.values() for sid in r['stateIds']}
state_refs={str(sid):{'name':STATES[sid]['name'],'ownerTag':STATES[sid]['ownerTag'],
                    'controllerTag':STATES[sid].get('controllerTag'),
                    'sourceRefs':STATES[sid]['sourceRefs']} for sid in sorted(needed_states)}
out={'version':1,'openingDate':CATALOG['openingDate'],'defaultControllers':defaults,'factions':factions,
     'unitControls':controls,'wars':WARS,'stateEvidence':state_refs,'projections':projections,'seatBindings':seat_bindings,
     'inputs':{'countriesSha256':digest(ROOT/'src/data/countries.json'),
               'geographySha256':digest(ROOT/'src/data/world-geography-index.json')},
     'sourceFiles':source_files,'geonames':{'url':'https://download.geonames.org/export/dump/cities15000.zip',
        'license':'CC BY 4.0','sha256':cities_hash},'warnings':warnings,
     'counts':{'factions':len(factions),'mappedUnits':len(controls),'clearUnits':sum(not r['uncertain'] for r in controls.values()),
               'mixedOrUncertainUnits':sum(r['uncertain'] for r in controls.values()),'referenceCities':sum(len(x['anchors']) for x in projections.values())},
     'limitations':['控制沿用MOD的2020开局，与现实当前战线不同。','真实县界保留原样；MOD战略省份只作为控制证据。',
                    '参考点投影不能精确恢复县内战线；跨多方或映射误差较大的地区保留不确定标记。',
                    '没有可核对的城市参考点时不编造地方控制方。']}
(ROOT/'src/data/opening-control.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(out['counts'],ensure_ascii=False))
