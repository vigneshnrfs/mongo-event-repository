/**
 * Created by Vignesh Jagadeesh on 18/5/16.
 */

"use strict";


function Schema(obj){

  //TODO assert if name exists

  this.indices = obj.indices;
  this.obj = obj;
  this.events = obj.events;
}



module.exports = Schema;