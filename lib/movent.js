/**
 * Created by Vignesh Jagadeesh on 18/5/16.
 *
 *
 */

'use strict';

const client = require('mongodb').MongoClient,
  Promise = require('bluebird'),
  Redis = require('ioredis'),
  logger = require('winston'),
  EventEmitter = require('events').EventEmitter;

const Schema = require('./schema'),
  Model = require('./model');

function Movent() {
  this.models = {};
  this.modelSchemas = {};
  this.db = null;
  this.redis = null;
  this.notify = null;
}


require('util').inherits(Movent,EventEmitter);

Movent.prototype.setNotifier = function(amqpPublisher){
  this.notify = amqpPublisher;
};

Movent.prototype.connectToMongo = function (mongoUrl) {
  const _this = this;

  return new Promise((resolve, reject)=> {
    client.connect(mongoUrl,function(err,db){
      if(err) {
        logger.error('✗ MongoDB Connection Error. Please make sure MongoDB is running: ', err);
        return reject(err);
      }
      logger.info('Connected to mongodb',{url:mongoUrl});
      _this.db = db;
      return resolve();
    });
  });
};

Movent.prototype.connectToRedis = function(redisPort,redisUrl){
  const _this = this;
  return new Promise((resolve,reject)=>{
    _this.redis = new Redis(redisPort, redisUrl);
    
    //Test if redis is connected;
    _this.redis.set('test','0').then(()=>{
      logger.info(`Connected to redis server on ${redisUrl}:${redisPort}`);
      resolve();
    }).catch((err)=>{
      logger.error('✗ Redis Connection Error. Please make sure Redis Server is running: ', err);
    });
  });
};

Movent.prototype.Schema = Schema;

Movent.prototype.model = function(name,schema){
  const _this = this;

  //Return the model if no schema is given.
  if(!schema) {

    if(!_this.models[name]){
      return  new Error('Schema not initialized for model ' + name);
    }
    return this.models[name];
  }
  
  this.models[name] = new Model(name,schema,_this);
  
  return this.models[name];
};

Movent.prototype.getModelNames = function(){
  return Object.keys(this.models);
};

module.exports = new Movent();