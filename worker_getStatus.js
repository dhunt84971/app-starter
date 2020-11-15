//#region GLOBAL DECLARATIONS
"use strict";
const electron = require("electron");
const {remote} = require("electron");
const ps = require('ps-node');
const os = require('os');
// Use tasklist instead of ps-node if this is a Windows computer.
var tasklist = ()=>{return;};
if (os.platform=="win32") tasklist = require('tasklist');
//#endregion GLOBAL DECLARATIONS

//#region GLOBAL VARIABLES
var apps ={};
var state = "STARTING";
var checkAppStatus = true;
const slowPoll = 60;
const checkFastTime = 5;
var checkFast = checkFastTime;
var fastPollActive = false;
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
function updateAppStatus(app){
    if (app.running){
        if (app.state == "STOPPED"){
            app.state = "MONITORING";
            app.status = "RUNNING";
        }
        else if (app.state == "STOPPING"){
            app.status = "STOPPING";
        }
        else if (app.state == "STARTING"){
            app.state = "MONITORING";
            app.status = "RUNNING";
        }
        else {
            app.state = "RUNNING";
            app.status = "RUNNING";
        }
    }
    else { //!app.running
        if (app.state == "STARTING"){
            app.status = "STARTING";
        }
        else if (app.state == "MONITORING" && app.restart == "true"){
            startApp(app);
        }
        else {
            app.state = "STOPPED";
            app.status = "STOPPED";
        }
    }
    //updateAppLabelStatus(app);
}

function checkWinIsRunning(app, tasks, callback){
    var task = tasks.find(x => x.imageName == app.exeName);
    if (task){
        app.running = true;
        app.pid = task.pid;
    }
    else{
        app.running = false;
    }
    if (callback){
        callback(app);
    }
    return app.running;
}

async function checkUxIsRunning(app, callback){
    ps.lookup({command: app.exeName}, (err, resultList)=>{
        if (err) {
            throw new Error( err );
        }
        app.running = resultList.length>0;
        if (app.running) app.pid = resultList[0].pid;
        if (callback){
            callback(app);
        }
        return app.running;
    });
}

async function checkIsRunning(){
    if (os.platform() != "win32"){
        for (var i=0; i<apps.length; i++){
            checkUxIsRunning(apps[i], (app)=>{updateAppStatus(app);});
        }
    }
    else {
        var tasks = await tasklist();
        for (var i=0; i<apps.length; i++){
            checkWinIsRunning(apps[i], tasks, (app)=>{updateAppStatus(app);});
        }
    }
}

async function checkAppsFast(){
    fastPollActive = true;
    checkFast = checkFastTime;
    while(checkFast > 0){
        checkFast > 0 ? checkFast-- : checkFast = 0;
        console.log("checkFast = " + checkFast);
        checkIsRunning();
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, 1000);
        });
    }
    fastPollActive = false;
}

async function checkAppsSlow(){
    while(checkAppStatus){
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, slowPoll * 1000);
        });
        checkIsRunning();
    }
}

function getAppByName(name){
    for (var i=0; i<apps.length;i++){
        if (apps[i].name == name) return apps[i];
    }
    return;
}
//#endregion BACKEND FUNCTIONS

//#region INITIALIZATION
electron.ipcRenderer.on('apps', (event, message) => {
    apps = message;
    console.log(apps);
    checkAppsSlow();
});

electron.ipcRenderer.on('stopApp', (event, message) => {
    app = message;
    console.log(app);
    checkAppsSlow();
});

//#endregion INITIALIZATION

//#region EVENT HANDLERS
//#endregion EVENT HANDLERS

