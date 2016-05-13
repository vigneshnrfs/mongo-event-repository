'use strict';

/**
 * Module main constructor
 */

const client = require('mongodb').MongoClient,
  Promise = require('bluebird'),
  Redis = require('ioredis'),
  _ = require('lodash');


function Repository() {
  var self = this;
  this.db = null;
  this.redis = null;
  this.counters = null;
  this.Model = Model

}


Repository.prototype.connectToMongo = function (mongoUrl) {
  var self = this;

  return new Promise(function (resolve, reject) {

    client.connect(mongoUrl, function (err, db) {
      if (err) {
        console.log('✗ MongoDB Connection Error. Please make sure MongoDB is running: ', err);
        //self.emit('error', err);
        return reject(err);
      }

      self.db = db;

      console.log('Initialized connection to mongo at %s', mongoUrl);
      return resolve();
      //self.emit('connected', db);
    });

  });

};

// Connect to Redis
Repository.prototype.connectToRedis = function (redisPort,redisUrl) {
  var self = this;
  return new Promise(function (resolve, reject) {

    self.redis = new Redis(redisPort,redisUrl);

    self.redis.set('test','0').then(function(test){
      console.log('-----Conection To Redis Successful ------');
      self.counters = new Counters(self.redis);
      resolve();

    },function(err){
      console.log('err.....',err);
      console.log('Error connection to redis...',err);
      reject(err);
    });


  });

};

Repository.prototype.model = function (modelName) {

  return new this.Model(modelName);

};

var repository = module.exports = new Repository();

function Model(name) {

  this.modelName = name;

  this.events = repository.db.collection(this.modelName + '.events');
  this.snapshots = repository.db.collection(this.modelName + '.snapshots');
  //console.log('--------------', this.events, '-----------------------');

}

Model.prototype.entity = function (id) {
  var self = this;

  return new Promise(function (resolve, reject) {

    self._ifEntityExists(id).then((exists)=> {
      if (!exists) {
        self.events.ensureIndex({ _id: 1, id: 1 });
        self.events.ensureIndex({ id: 1, version: 1 });
        repository.counters.initializeCounter(self.modelName, id).then(function () {
          console.log('Initialized Counter...');
          resolve(new Entity(self.modelName, id));
        }, function error(err) {
          console.log('Error occurred when Initializing Counter. ', err);
          reject(err);
        });
      } else {
        resolve(new Entity(self.modelName,id));
      }
    }, function error(err) {
      console.log('Error occurred when checking entityexists ', err);

      reject(err);

    });

  });

};

Model.prototype.getEvents = function (id) {
  var self = this;

  self.events.find({ id: id }, function (err, events) {

  });
};

Model.prototype._ifEntityExists = function (id) {
  var self = this;

  return new Promise(function (resolve, reject) {
    self.events.findOne({ id: id }, function (err, doc) {
      if (err) return reject(err);
      if (doc) return resolve(true);
      return resolve(false);
    });
  });

};

function Entity(modelName, id) {
  console.log('New Entity Initialisation....',modelName, id);

  this.modelName = modelName;
  const self = this;

  Repository.call(this);
  this.events = repository.db.collection(this.modelName + '.events');
  this.snapshots = repository.db.collection(this.modelName + '.snapshots');

  self.id = id;

}

Entity.prototype.createEvent = function (eventName, payload) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var ok = repository.counters.getVersion(self.modelName, self.id);

    ok.then((version)=> {

      self.events.insertOne({

        id: self.id,
        version: version,
        event: eventName,
        payload: payload || {},
        createdAt: new Date()

      }, function (err, doc) {

        if (err) reject(err);

        resolve(doc);

      });

    });

  });
};

Entity.prototype.replayEvents = function(){
  var self = this;
  return new Promise(function(resolve,reject){
      self.events.find({id:self.id}).sort({version:1}).toArray(function(err,events){
        if(err) return reject(err);

        var currentState = {};
        _.forEach(events,function(event){
          _.merge(currentState,event.payload);
        });

        //console.log(events);

        if(events){
          currentState.id = self.id;
          currentState.createdAt = events[0].createdAt;
          currentState.updatedAt = events[events.length -1].createdAt;
          return resolve(currentState);

        }

        return resolve();

      });
  });
};

function Counters(redis) {
  this.keyPrefix = 'versions';
  this.redis = redis;
  var self = this;

}

Counters.prototype.initializeCounter = function (modelName, key) {
  var self = this;

  console.log('Initializing Counter for ' + modelName + ' ' + key);

  let counterKey = `${self.keyPrefix}:${modelName}:${key}`;
  return self.redis.set(counterKey, '0');
};

Counters.prototype.getVersion = function (modelName, key) {
  var self = this;
  let counterKey = `${self.keyPrefix}:${modelName}:${key}`;

  return new Promise(function (resolve, reject) {
    self.redis.incr(counterKey).then(function (version) {
      console.log('Version : ' + version);
      resolve(version)
    });
  });

};
