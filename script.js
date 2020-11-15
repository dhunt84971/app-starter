//#region GLOBAL DECLARATIONS
"use strict";
const electron = require("electron");
const { remote } = require("electron");
const { dialog } = require("electron").remote;
const { exec, spawn, execFile } = require('child_process');
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
    updateAppLabelStatus(app);
}

async function startApps(){
    fastPollActive ? checkFast = checkFastTime : checkAppsFast();
    for (var i=0; i<apps.length; i++){
        if (apps[i].enabled == "true"){
            apps[i].state = "STARTING";
            updateAppStatus(apps[i]);
        }
    }
    for (var i=0; i<apps.length; i++){
        console.log("Waiting " + apps[i].startDelay + 
            " seconds to start " + apps[i].name 
        );
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, apps[i].startDelay * 1000);
        });
        if (apps[i].enabled == "true") startApp(apps[i]);
    }
}

function startApp(app){
    fastPollActive ? checkFast = checkFastTime : checkAppsFast();
    console.log("Starting " + app.name);
    app.state = "STARTING";
    app.status = "STARTING";
    updateAppStatus(app);
    //let path = app.path.replace(/ /g, '\\ ');
    let path = (os.platform == "win32")? app.path.replace(/\//g, '\\\\'): app.path;
    console.log(path);
    execFile(app.exeName, [] ,{'cwd': path }, (error) => {
        if (error){
            console.log(error);
        }
    });
}

async function stopApps(){
    fastPollActive ? checkFast = checkFastTime : checkAppsFast();
    for (var i=apps.length-1; i>-1; i--){
        if (apps[i].enabled == "true"){
            apps[i].state = "STOPPING";
            apps[i].status = "STOPPING";
            updateAppStatus(apps[i]);
        }
    }
    for (var i=apps.length-1; i>-1; i--){
        stopApp(apps[i]);
        console.log("Waiting " + apps[i].startDelay + " seconds.");
        await new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve();}, apps[i].startDelay * 1000);
        });
    }
}

function stopApp(app){
    fastPollActive ? checkFast = checkFastTime : checkAppsFast();
    console.log("Stopping " + app.name);
    if (app.pid){
        app.state = "STOPPING";
        app.status = "STOPPING";
        updateAppStatus(app);
        ps.kill(app.pid, "SIGTERM");
    }
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

function startWorker_getStatus(){
    var workerWindow = new BrowserWindow({
        parent: remote.getCurrentWindow(),
        show: false,
        webPreferences: { 
            nodeIntegration: true,
            enableRemoteModule: true
        }
    }); 
    workerWindow.loadFile('worker_getStatus.html');
    win.webContents.openDevTools();
    win.webContents.on('did-finish-load', () => {
        win.webContents.send("apps", apps);
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
            //checkAppsSlow();

            startApps();
        }
    })
    .catch((error)=>{
        alert("Problem with settings file - " + error);
    });
}

init();
//#endregion INITIALIZATION

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

