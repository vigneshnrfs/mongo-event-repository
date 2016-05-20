/**
 * Created by zapstitch on 18/5/16.
 */
'use strict';

var Repository = require('./lib/movent');
var Schema = Repository.Schema;

var ok = Repository.connectToMongo('mongodb://localhost:27017/repo-test');

ok = ok.then(()=> {
  return Repository.connectToRedis(6379, 'localhost')
});

ok = ok.then(()=>{
 return  startTest()
}).catch(console.log);

/*
Repository.on('recordAdded',(msg)=>{
  console.log('RECORD ADD EMIT',msg);
});
*/

function startTest() {

  //Define Schema
  var schema = new Schema({
    indices:['idx1','idx2'],
    onDigest:'testModelUpdated',
    events:[{
      name:'firstEvent',
      onDigest:'firstEventCreated'
    },{
      name:'secondEvent',
      onDigest:'secondEventCreated'
    }]
  });


  Repository.model('testModel',schema);

  var mdl = Repository.model('testModel');
  /*console.log('MODELS',Repository.getModelNames());
  console.log('Model',mdl);
  */

  var entity = mdl.Entity();


  /*entity.on('firstEventCreated',(msg)=>{
    console.log('first Event Emitted ',msg);
  });

  entity.on('secondEventCreated',(msg)=>{
    console.log('second Event Emitted ',msg);
  });*/

  var id = entity.id;
  //console.log(entity.id);

  var aa = entity.firstEvent({name:'VJ',email:'vj@ss.co',idx1:1,idx2:2,idx3:3});
  aa.then().catch(console.log);


  entity = mdl.Entity(id);
  //console.log(entity.id);

  aa = entity.secondEvent({name:'VJ',email:'vj@ss.co',idx1:1,idx2:3});
  aa.then().catch(console.log);

  setTimeout(()=>{
    entity.getCurrentState().then((data)=>{
      console.log('------------');
      console.log(data);
    });
  },3000);

}