import fs from 'node:fs/promises';
import path from 'node:path';
import * as shapefile from 'shapefile';

const root = '/tmp/election_validation/POLLING_STATION_2020/POLLING_STATIONS';
const output = new URL('../public/data/', import.meta.url);
await fs.mkdir(output, { recursive: true });

const stations = [];
const source = await shapefile.open(`${root}.shp`, `${root}.dbf`, { encoding: 'utf-8' });
while (true) {
  const item = await source.read();
  if (item.done) break;
  const p = item.value.properties;
  stations.push({
    id: String(p.Polling_Di ?? ''),
    province: p.Province,
    district: p.District,
    constituency: p.Constitu_1,
    ward: p.Ward,
    pollingDistrict: p.Polling__1,
    station: p.Polling_St,
    male: Number(p.Male || 0),
    female: Number(p.Female || 0),
    registered: Number(p.Voters || 0),
    latitude: Number(p.Latitude || item.value.geometry.coordinates[1]),
    longitude: Number(p.Longitude || item.value.geometry.coordinates[0])
  });
}

const candidates = [
  ['Kelvin F. Bwalya','ZMP'],['Given M. Chansa','MEE'],['Xavier F. Chungu','LDP'],
  ['Hakainde S. Hichilema','UPND'],['Harry Kalaba','CF'],['Given Katuta','Independent'],
  ['Howard Kunda','ZAWAPA'],['Fred M’membe','SP'],['Brian M. Mundubile','NRPUP'],
  ['Brian Mushimba','OPP'],['Ackim A. Njobvu','DU'],['Daniel C. Pule','CDP'],
  ['Richwell Siamunene','NFP'],['Richard Silumbe','LM']
].map(([name,party],i)=>({id:i+1,name,party}));

await fs.writeFile(new URL('polling-stations.json', output), JSON.stringify(stations));
await fs.writeFile(new URL('candidates.json', output), JSON.stringify(candidates));
await fs.writeFile(new URL('summary.json', output), JSON.stringify({
  stations: stations.length,
  registeredVoters: stations.reduce((a,b)=>a+b.registered,0),
  provinces: new Set(stations.map(x=>x.province)).size,
  districts: new Set(stations.map(x=>`${x.province}|${x.district}`)).size,
  constituencies: new Set(stations.map(x=>`${x.province}|${x.district}|${x.constituency}`)).size,
  wards: new Set(stations.map(x=>`${x.province}|${x.district}|${x.ward}`)).size
}));
console.log(`Prepared ${stations.length} polling stations`);
