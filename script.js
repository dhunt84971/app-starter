//#region GLOBAL DECLARATIONS
"use strict";
const electron = require("electron");
const { remote } = require("electron");
const { dialog } = require("electron").remote;
const { exec, spawn, execFile } = require('child_process');
const ps = require('ps-node');
const tasklist = require('tasklist');
const os = require('os');
//#endregion GLOBAL DECLARATIONS


//#region GLOBAL VARIABLES
var apps ={};
var state = "starting";
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
async function startApps(){
    fastPollActive ? checkFast = checkFastTime : checkAppsFast();
    for (var i=0; i<apps.length; i++){
        if (apps[i].enabled == "true"){
            apps[i].state = "starting";
            apps[i].status = "STARTING";
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
    app.state = "starting";
    app.status = "STARTING";
    updateAppStatus(app);
    //let path = app.path.replace(/ /g, '\\ ');
    let path = app.path.replace(/\//g, '\\\\');
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
            apps[i].state = "stopping";
            apps[i].status = "STOPPING";
            updateAppStatus(apps[i]);
        }
    }
    for (var i=apps.length-1; i>-1; i--){
        stop(apps[i]);
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
        app.state = "stopping";
        app.status = "STOPPING";
        updateAppStatus(app);
        ps.kill(app.pid, "SIGKILL");
    }
}

async function checkAppsFast(){
    fastPollActive = true;
    checkFast = checkFastTime;
    while(checkFast > 0){
        checkFast > 0 ? checkFast-- : checkFast = 0;
        console.log("checkFast = " + checkFast);
        if (!os.platform() == "win32"){
            for (var i=0; i<apps.length; i++){
                checkIsRunning(apps[i], (app)=>{
                    app.status = app.running ? "RUNNING" : "STOPPED";
                    updateAppStatus(app);
                    console.log("App " + app.exeName + " is " + app.status);
                    if (app.running && app.state == "starting"){
                        app.state = "monitoring";
                        console.log("Monitoring " + app.name);
                    }
                });
            }
        }
        else{
            var tasks = await tasklist();
            for (var i=0; i<apps.length; i++){
                checkWinIsRunning(apps[i], tasks, (app)=>{
                    app.status = app.running ? "RUNNING" : "STOPPED";
                    updateAppStatus(app);
                    console.log("App " + app.exeName + " is " + app.status);
                    if (app.running && app.state == "starting"){
                        app.state = "monitoring";
                        console.log("Monitoring " + app.name);
                    }
                });
            }
        }
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
        if (!os.platform() == "win32"){
            for (var i=0; i<apps.length; i++){
                checkIsRunning(apps[i], (app)=>{
                    app.status = app.running ? "RUNNING" : "STOPPED";
                    updateAppStatus(app);
                    console.log("App " + app.exeName + " is " + app.status);
                    if (!app.running && app.restart == "true" && app.state == "monitoring"){
                        console.log("Starting " + app.name);
                        startApp(app);
                    }
                    if (app.running && app.state == "starting"){
                        app.state = "monitoring";
                        console.log("Monitoring " + app.name);
                    }
                });
            }
        }
        else {
            var tasks = await tasklist();
            for (var i=0; i<apps.length; i++){
                checkWinIsRunning(apps[i], tasks, (app)=>{
                    app.status = app.running ? "RUNNING" : "STOPPED";
                    updateAppStatus(app);
                    console.log("App " + app.exeName + " is " + app.status);
                    if (!app.running && app.restart == "true" && app.state == "monitoring"){
                        console.log("Starting " + app.name);
                        startApp(app);
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

async function checkIsRunning(app, callback){
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

function getAppByName(name){
    for (var i=0; i<apps.length;i++){
        if (apps[i].name == name) return apps[i];
    }
    return;
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
    inner += "<div id='lbl_" + app.name + "' class='label lblName' ";
    inner += "title='" + app.description + "'>" + app.name + "</div>";
    inner += "<div id='btnStart_"+ app.name +"' class='btn btnAction green' onclick='btnStart_click(this);'>START</div>";
    inner += "<div id='btnStop_"+ app.name +"' class='btn btnAction red' onclick='btnStop_click(this);'>STOP</div>";
    inner += "<div id='lblStatus_"+ app.name +"' class='label'>PENDING</div>";
    inner += "</div>";
    newItem.innerHTML = inner;
    divList.appendChild(newItem);  
}

function updateAppStatus(app){
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
            checkAppsSlow();
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

//#endregion EVENT HANDLERS

