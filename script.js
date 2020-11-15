//#region GLOBAL DECLARATIONS
"use strict";
const electron = require("electron");
const { remote } = require("electron");
const { dialog } = require("electron").remote;
const ipc = require("electron").ipcRenderer;
const { exec, spawn, execFile } = require('child_process');
const ps = require('ps-node');
const os = require('os');
// Use tasklist instead of ps-node if this is a Windows computer.
var tasklist = ()=>{return;};
if (os.platform=="win32") tasklist = require('tasklist');

var workerWin_getStatus;
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
    updateAppLabelStatus(app);
}

function startApps(){
    workerWin_getStatus.webContents.send("startApps", null);
}

function startApp(app){
    workerWin_getStatus.webContents.send("startApp", app.name);
}

function stopApps(){
    workerWin_getStatus.webContents.send("stopApps", null);
}

function stopApp(app){
    workerWin_getStatus.webContents.send("stopApp", app.name);
}

function getAppByName(name){
    for (var i=0; i<apps.length;i++){
        if (apps[i].name == name) return apps[i];
    }
    return;
}

function startWorker_getStatus(callback){
    workerWin_getStatus = new remote.BrowserWindow({
        parent: remote.getCurrentWindow(),
        show: false,
        webPreferences: { 
            nodeIntegration: true,
            enableRemoteModule: true
        }
    }); 
    workerWin_getStatus.loadFile('worker_getStatus.html');
    workerWin_getStatus.webContents.openDevTools();
    workerWin_getStatus.webContents.on('did-finish-load', () => {
        workerWin_getStatus.webContents.send("apps", apps);
        callback();
    });

}
//#endregion BACKEND FUNCTIONS

//#region PAGE RENDER FUNCTIONS
function addApps(){
    for (var i=0; i<apps.length; i++){
        addApp(apps[i]);
    }
}

function addApp(app){
    /* HTML for Reference
    <div class="vbox noPadding noMargin">
    <div class="vertDivider"></div>
        <div class="hbox noPadding noMargin">
        <div class="label lblName">mousepad</div>
        <div class="btn btnAction">START</div>
        <div class="btn btnAction">STOP</div>
        <div class="label">RUNNING</div>
    </div> 
    </div>
    */
    var divList = document.getElementById("divAppList");
    var newItem = document.createElement("div");
    newItem.classList.add("vbox");
    newItem.classList.add("noPadding");
    newItem.classList.add("noMargin");
    newItem.id = "div_" + app.name;
    var inner = "";
    inner += "<div class='vertDivider'></div>";
    inner += "<div class='hbox noPadding noMargin'>";
    inner += "<div id='lbl_" + app.name + "' class='label lblName";
    inner += app.enabled == "true" ? "' " : " disabled' ";
    inner += "title='" + app.description + "'>" + app.name + "</div>";
    inner += "<div id='btnStart_"+ app.name +"' class='btn btnAction' onclick='btnStart_click(this);'"
    inner += "title='Start "+ app.name +"'>";
    inner += "<img src='images/start.png' width=20px /></div>";
    inner += "<div id='btnStop_"+ app.name +"' class='btn btnAction' onclick='btnStop_click(this);'"
    inner += "title='Stop "+ app.name +"'>";
    inner += "<img src='images/stop.png' width=20px /></div>";
    inner += "<div id='btnUp_"+ app.name +"' class='btn btnAction' onclick='btnUp_click(this);'"
    inner += "title='Up "+ app.name +"'>";
    inner += "<img src='images/up.png' width=20px /></div>";
    inner += "<div id='btnDown_"+ app.name +"' class='btn btnAction' onclick='btnDown_click(this);'"
    inner += "title='Down "+ app.name +"'>";
    inner += "<img src='images/down.png' width=20px /></div>";
    inner += "<div id='btnEdit_"+ app.name +"' class='btn btnAction' onclick='btnEdit_click(this);'"
    inner += "title='Edit "+ app.name +"'>";
    inner += "<img src='images/edit.png' width=20px /></div>";
    inner += "<div id='lblStatus_"+ app.name +"' class='label'>PENDING</div>";
    inner += "</div>";
    newItem.innerHTML = inner;
    divList.appendChild(newItem);  
}

function updateAppLabelStatus(app){
    let lblStatus = document.getElementById("lblStatus_" + app.name);
    lblStatus.innerHTML = app.status;
    app.status == "RUNNING" ? 
        lblStatus.classList.add("running") : 
        lblStatus.classList.remove("running");
    app.status == "STOPPING" || app.status == "STARTING" ?
        lblStatus.classList.add("transition") : 
        lblStatus.classList.remove("transition");
    app.status == "STOPPED" ?
        lblStatus.classList.add("stopped") : 
        lblStatus.classList.remove("stopped");
    

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
            addApps();
            startWorker_getStatus(()=>{
                startApps();    
            });
        }
    })
    .catch((error)=>{
        alert("Problem with settings file - " + error);
    });
}

init();
//#endregion INITIALIZATION

//#region IPC EVENT HANLDERS
ipc.on("updateAppStatus", (event, message) => {
    let app = message;
    console.log(app);
    updateAppStatus(app);
});

//#endregion IPC EVENT HANDLERS

//#region EVENT HANDLERS
document.getElementById("btnStartAll").addEventListener("click", ()=>{
    startApps();
});

document.getElementById("btnStopAll").addEventListener("click", ()=>{
    stopApps();
});

function btnStart_click(el){
    let app = getAppByName(el.id.split("_")[1]);
    startApp(app);
}

function btnStop_click(el){
    let app = getAppByName(el.id.split("_")[1]);
    stopApp(app);
}

function btnUp_click(el){

}

function btnDown_click(el){

}

function btnEdit_click(el){

}

//#endregion EVENT HANDLERS

