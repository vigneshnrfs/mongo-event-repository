/**
 * Created by Vignesh Jagadeesh on 18/5/16.
 */

"use strict";

const _ = require('lodash'),
  Promise = require('bluebird'),
  shortid = require('shortid32'),
  EventEmitter = require('events').EventEmitter;

function Model(name, schema, base) {
  this.name = name;
  this.schema = schema;
  this.base = base;
  this.db = base.db;
  this.redis = base.redis;
  this.notify = base.notify;

  this.collection = base.db.collection(`${name}.events`);

  //applyEvents(schema, this);
}

require('util').inherits(Model, EventEmitter);

var applyEvents = function (schema, base) {
  const _this = base,
    events = schema.events;

  _.forEach(events, function (event) {

    Model.prototype[event.name] = function (payload) {

      return new Promise((resolve, reject)=> {

        var obj = {
          id: _this.id,
          eventName: event.name,
          payload: payload,
          createdAt: new Date().toISOString()
        };

        //Check if the entity is new;
        if (_this.isNew) {
          _.forEach(_this.schema.indices, function (idx) {
            obj[idx] = _this[idx];
            //delete payload[idx];
          });
        } else {
          var doc = _this.collection.findOne({ id: _this.id });
          if (!doc) return reject(new Error(`Entity with id ${id} has not initialized before`));
          _.forEach(_this.schema.indices, function (idx) {
            obj[idx] = doc[idx];
          });
        }

        _this.getVersion().then((version)=> {
          obj.version = version;

          _this.collection.insertOne(obj, (err, doc)=> {
            if (err) return reject(err);

            _this.emit(event.onDigest, obj);
            _this.base.emit(`recordAdded`, { model: _this.name, data: obj });
            return resolve(obj);
          });

        }).catch(reject);

      });
    }
  });

};

Model.prototype.createEvent = function (eventName, payload) {
  const _this = this;
  const schema = this.schema;
  const events = schema.events;

  return new Promise((resolve, reject)=> {

    var schemaInfo = _.find(events, { name: eventName });

    if (!schemaInfo) {
      return reject(new Error('Event Name not defined'));
    }

    var obj = {
      id: _this.id,
      eventNme: eventName,
      payload: payload,
      createdAt: new Date().toISOString()
    };

    //Check if the entity is new
    if (_this.isNew) {
      _.forEach(_this.schema.indices, function (idx) {
        obj[idx] = _this[idx];
      })
    } else {
      var doc = _this.collection.findOne({ id: _this.id });
      if (!doc) return reject(new Error(`Entity with id ${id} has not initialized before`));
      _.forEach(_this.schema.indices, function (idx) {
        obj[idx] = doc[idx];
      });
    }

    //Get versions
    _this.getVersion().then((version)=> {
      obj.version = version;

      _this.collection.insertOne(obj, (err, doc)=> {
        if (err) return reject(err);

        resolve(obj);

        // Notify general notification
        _this.notify(_this.schema.onDigest,obj);
        
        //Notify for specific event
        if(schemaInfo.onDigest) _this.notify(schemaInfo.onDigest,obj);
      });

    }).catch(reject);

  });
};

Model.prototype.getVersion = function () {
  const _this = this;
  let counterKey = `versions:${_this.name}:${_this.id}`;

  return new Promise(function (resolve, reject) {
    _this.redis.incr(counterKey).then(function (version) {
      //console.log('Version : ' + version);
      resolve(version)
    });
  });
};

Model.prototype.entity = function (id) {
  if (!id) throw new Error('id missing for entity initialization');
  this.id = id;
  return this;
};

Model.prototype.newEntity = function (indices) {
  var _this = this;
  this.isNew = true;
  this.id = shortid.generate();
  _.forEach(_this.schema.indices, function (idx) {
    if (!indices[idx]) throw new Error(`Index field ${idx} missing in payload`);
    _this[idx] = indices[idx];
  });

  return _this;
};

Model.prototype.getCurrentState = function () {
  var _this = this;

  return new Promise((resolve, reject)=> {
    _this.collection.find({ id: _this.id }).sort({ version: 1 }).toArray(function (err, events) {
      if (err) return reject(err);
      replayEvents(events);
    });

    var currentState = { id: _this.id };
    _.forEach(_this.schema.indices,(idx)=>{
     currentState[idx] = events[0][idx];
     });

    function replayEvents(events) {
      //console.log(events);

      _.forEach(events, (event)=> {
        _.merge(currentState, event.payload);


      });

      currentState.createdAt = events[0].createdAt;
      currentState.updatedAt = events[events.length - 1].createdAt;


      /*console.log('======================');
      console.log(currentState);
      console.log('======================');*/
      return resolve(currentState);

    }

  });

};

module.exports = Model;