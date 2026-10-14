// Public limited catalogue for tenant self-enrollment. No tenant names, private rooms or documents exposed.
const router=require('express').Router();
const mongoose=require('mongoose');const {Property,Room,Tenancy}=require('../../models');
const {asyncRoute,fail}=require('../../core/errors');
const {auth,roles}=require('../../core/auth');
router.use(auth,roles('tenant'));
router.get('/properties',asyncRoute(async(req,res)=>{
 const properties=await Property.find({acceptingEnrollments:true}).select('_id name location').sort({createdAt:-1}).limit(100).lean();
 res.json({data:properties.map(p=>({id:String(p._id),name:p.name,location:p.location||''}))});
}));
router.get('/properties/:id/rooms',asyncRoute(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))fail(400,'Invalid property ID');
 const property=await Property.findOne({_id:req.params.id,acceptingEnrollments:true}).select('_id');if(!property)fail(404,'Property not found');
 const rooms=await Room.find({propertyId:property._id,status:'active'}).select('_id propertyId number rentPaise').limit(300).lean();
 const occupied=await Tenancy.find({roomId:{$in:rooms.map(x=>x._id)},status:'active'}).select('roomId').lean();
 const used=new Set(occupied.map(x=>String(x.roomId)));
 res.json({data:rooms.filter(x=>!used.has(String(x._id))).map(r=>({id:String(r._id),propertyId:String(r.propertyId),number:r.number,rentPaise:r.rentPaise}))});
}));
module.exports=router;
