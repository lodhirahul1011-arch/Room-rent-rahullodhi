const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(v){if(typeof v!=='string'||!DATE.test(v))return false;const d=new Date(v+'T00:00:00.000Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
function assertMoveIn(v){if(!validDate(v))throw Object.assign(new Error('Invalid move-in date'),{status:400});return v}
function assertMoveOut(moveIn,moveOut){if(!validDate(moveOut)||moveOut<moveIn)throw Object.assign(new Error('Move-out must be on/after move-in'),{status:400});return moveOut}
function occupancy(room,activeTenancy){return room.status==='maintenance'?'maintenance':activeTenancy?'occupied':'vacant'}
function roomMatchesFloor(room,floor){return String(room.propertyId)===String(floor.propertyId)&&String(room.organizationId)===String(floor.organizationId)}
function canSubmitEnrollment({room,property}){return !!room&&!!property&&String(room.propertyId)===String(property._id)&&String(room.organizationId)===String(property.organizationId)&&room.status==='active'}
module.exports={validDate,assertMoveIn,assertMoveOut,occupancy,roomMatchesFloor,canSubmitEnrollment};
