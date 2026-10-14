import type { Portfolio, Property, Floor, Room, Tenant, Tenancy } from './types';
const names = ['Lakeview Residency','Palm Grove Apartments','The Terrace House','Parkside Homes'];
const locations = ['Koramangala, Bengaluru','Andheri West, Mumbai','Hitech City, Hyderabad','Salt Lake, Kolkata'];
const roomCounts = [24,18,12,8];
const occupied = [22,16,10,7];
export function createSeedPortfolio(): Portfolio {
  const properties: Property[] = names.map((name,i) => ({ id:`property-${i+1}`, name, location:locations[i], address:locations[i], createdAt:'2026-01-01' }));
  const floors: Floor[] = []; const rooms: Room[] = []; const tenants: Tenant[] = []; const tenancies: Tenancy[] = [];
  properties.forEach((property,pindex) => {
    const count=roomCounts[pindex]; const floorCount=Math.ceil(count/6);
    for(let f=0;f<floorCount;f++) floors.push({ id:`floor-${pindex+1}-${f+1}`,propertyId:property.id,name:`Floor ${f+1}`,order:f+1 });
    for(let r=0;r<count;r++) {
      const floor=Math.floor(r/6)+1; const number=`${floor}${String(r%6+1).padStart(2,'0')}`; const id=`room-${pindex+1}-${r+1}`;
      rooms.push({ id,propertyId:property.id,floorId:`floor-${pindex+1}-${floor}`,number,rentPaise:(12000+(pindex*1500)+(r%5)*1500)*100,status:'active' });
      if(r<occupied[pindex]) {const tid=`tenant-${pindex+1}-${r+1}`; tenants.push({id:tid,name:`${['Aarav','Riya','Rahul','Neha','Kabir','Priya','Ananya','Rohan'][r%8]} ${['Sharma','Kapoor','Verma','Mehta','Singh'][r%5]}`,phone:`98${String(10000000+pindex*100+r).slice(-8)}`,email:`tenant${pindex+1}.${r+1}@example.com`,emergencyContact:'',notes:''});tenancies.push({id:`tenancy-${pindex+1}-${r+1}`,tenantId:tid,roomId:id,moveIn:'2026-04-01',moveOut:null,status:'active'});}
    }
  });
  return {properties,floors,rooms,tenants,tenancies};
}
