import fs from 'node:fs/promises';
const stations=JSON.parse(await fs.readFile(new URL('../public/data/polling-stations.json',import.meta.url),'utf8'));
const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
const columns=['id','province','district','constituency','ward','polling_district','station','male','female','registered','latitude','longitude'];
const csv=[columns.join(','),...stations.map(s=>[s.id,s.province,s.district,s.constituency,s.ward,s.pollingDistrict,s.station,s.male,s.female,s.registered,s.latitude,s.longitude].map(quote).join(','))].join('\n');
await fs.mkdir(new URL('../server/import/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../server/import/polling_stations.csv',import.meta.url),csv);
console.log(`Exported ${stations.length} polling stations`);
