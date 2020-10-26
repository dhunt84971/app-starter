//#region GLOBAL DECLARATIONS
"use strict";
const electron = require("electron");
const { remote } = require("electron");
const { dialog } = require("electron").remote;
const { exec, spawn } = require('child_process');
const ps = require('ps-node');
//#endregion GLOBAL DECLARATIONS


//#region GLOBAL VARIABLES
var apps ={};
var state = "starting";
var checkAppStatus = true;
var checkTime = 10;
var appTemplate = {
    name: "name",
    path: "path",
    iconPath: "iconPath",
    enabled: false,
    startDelay: 0, //seconds
    restart: false,
}
//#endregion GLOBAL VARIABLES


//#region BACKEND FUNCTIONS
async function startApps(){
    for (var i=0; i<apps.length; i++){
        if (apps[i].enabled){
            apps[i].state = "starting";
        }
    }
    for (var i=0; i<apps.length; i++){
        console.log("Waiting " + apps[i].startDelay + 
            " seconds to start " + apps[i].name 
        );
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, apps[i].startDelay * 1000);
        });
        console.log("Starting " + apps[i].name);
        if (apps[i].enabled){
            exec(apps[i].path);
        }
    }
}

async function checkApps(){
    console.log(apps);
    while(checkAppStatus){
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, checkTime * 1000);
        });
        for (var i=0; i<apps.length; i++){
            if (apps[i].enabled){
                checkIsRunning(apps[i], (app)=>{
                    let status = app.running ? " is running." : " is stopped.";
                    console.log("App " + app.name + status);
                    if (!app.running && app.restart && app.state == "monitoring"){
                        app.state = "starting";
                        console.log("Starting " + app.name);
                        exec(app.path);
                    }
                    if (app.running && app.state == "starting"){
                        app.state = "monitoring";
                        console.log("Monitoring " + app.name);
                    }
                });
            }
        }
    }
}

function checkIsRunning(app, callback){
    ps.lookup({command: app.name}, (err, resultList)=>{
        if (err) {
            throw new Error( err );
        }
        app.running = resultList.length>0;
        if (callback){
            callback(app);
        }
        return resultList.length>0;
    });
}

function getAppByName(name){
    for (var i=0; i<apps.length;i++){
        if (apps[i].name) return apps[i];
    }
    return;
}
//#endregion BACKEND FUNCTIONS


//#region PAGE RENDER FUNCTIONS
function addApp(app){

/*
<div class="vertDivider"></div>
<div class="hbox noPadding noMargin">
  <div class="label lblName">mousepad</div>
  <div class="btn btnAction">START</div>
  <div class="btn btnAction">STOP</div>
  <div class="label">RUNNING</div>
</div> 
*/

      
}
//#endregion PAGE RENDER FUNCTIONS


//#region INITIALIZATION
async function init(){
    const libAppSettings = require("lib-app-settings");
    var appSettings = new libAppSettings(".settings");
    await appSettings.loadSettingsFromFile()
    .then((settings)=>{
        if (settings){
            apps = settings.apps;
            checkApps();
            startApps();
        }
    })
    .catch((error)=>{
        alert("Problem with settings file - " + error);
    });
}

init();
//#endregion INITIALIZATION




