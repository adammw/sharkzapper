/*
 * sharkzapper_background.js
 * This is the background script for sharkZapper which keeps track of settings, tabs and some commands
 *
 * sharkZapper is Copyright (C) 2010-2011 Adam Malcontenti-Wilson <adman.com@gmail.com>
 * You are hereby granted a licence to use the software as-is, and view the source code for educational purposes.
 * You may not create derivative versions of the software without written permission of the author.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * 
 * Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
 * "Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.
 */
// Global variables
var defaultAlbumArtUrl = 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png';	
var gsTabs = [];
var gsTabContentScriptLoaded = false;
var notifications = [];
var songNotifications = [];
var debug = false;
var debugStatusUpdate = false;
var pinnedPopup;
var pinnedPopupOpen = false;
var interactionPopup;
var interactionPopupOpen = false;
var lastSong = {};
var settingsVersion = 7;
var contextMenu = {};
var defaultSettings = {"newTabOnPopupClick": true, "showMuteButton": true, "showQueuePosition": true, "showQueueButtons": true, "showPlaybackButtons": true, "showNotificationOnSongChange": false, "showSearchBox": true, "showVolumeControlOnHover": true, "showAlbumArt": true}; 

// Create settings with defaults
if (!localStorage.settings || localStorage.settingsVersion < settingsVersion) {
    if (!localStorage.settings) {
	    localStorage.settings = JSON.stringify(defaultSettings);
	    localStorage.settingsVersion = settingsVersion;
    } else {
        //do upgrade!
        updatedSettings = JSON.parse(localStorage.settings);
        for (key in defaultSettings) {
            if (!updatedSettings[key]) updatedSettings[key] = defaultSettings[key];
        }
        // add specific setting changeovers here
        
        // store changes
        localStorage.settings = JSON.stringify(updatedSettings);
        localStorage.settingsVersion = settingsVersion;
    }
}

function getSetting(settingName) {
    try {
	    if (debug) console.log('setting response',settingName,JSON.parse(localStorage.settings)[settingName]);
	    return JSON.parse(localStorage.settings)[settingName];
    } catch(e) {
	    if (debug) console.log('setting response using default',settingName,JSON.parse(localStorage.settings)[settingName]);
        return defaultSettings[settingName];
    }
}

// Get all open Grooveshark tabs, then call callbacks
function get_gs_tab(success_callback, fail_callback, arg) {
	chrome.windows.getAll({'populate':true}, function(win) {
		gsTabs = [];
		for (wi in win) {
			for (ti in win[wi].tabs) {
 				if(win[wi].tabs[ti].url.indexOf('http://listen.grooveshark.com/')==0) {
					gsTabs.push(win[wi].tabs[ti].id);
 				}
 			}
 		}
		if(gsTabs.length > 0 && typeof success_callback == "function") {
			success_callback(arg);
		} else if(typeof fail_callback == "function") {
			fail_callback(arg);
		} 
 	});
}

// Inject our content scripts into the first grooveshark tab (should not be required after plugin is loaded due to manifest)
function inject_scripts() {
	if (gsTabs.length > 0) {
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/jquery-1.4.4.min.js'});		
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/sharkzapper_contentscript.js'});
		if (debug) console.log('Injected scripts into existing tab #' + gsTabs[0]);
		
		// Add our context menu
		create_contextmenu();
	}
}

// Open a new grooveshark tab or show the currently open one if there is one
function open_gs_tab(url) {
	if (gsTabs.length == 0) {
		if (url) {
			chrome.tabs.create({url:'http://listen.grooveshark.com/' + url});
		} else {
			chrome.tabs.create({url:'http://listen.grooveshark.com/'});
		}
	} else {
	    if (url) {
	        // Ensure that we only update url if it is different
	        chrome.tabs.get(gsTabs[0], function(url){ return function(tab) {
	            if (tab && tab.url == 'http://listen.grooveshark.com/' + url) {
	                chrome.tabs.update(gsTabs[0], {'selected':true});
                } else if (tab && tab.url != 'http://listen.grooveshark.com/' + url) {
                    chrome.tabs.update(gsTabs[0], {'url':'http://listen.grooveshark.com/' + url, 'selected':true});
                } else {
    				chrome.tabs.create({url:'http://listen.grooveshark.com/' + url});
				}
	        }}(url));
		} else {
		    chrome.tabs.update(gsTabs[0], {'selected':true});
		}
	}
}

// Respond to requests
chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
	    // Print requests to the console in debug mode
		if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:","<<<",request.command,request);
		
		// Ignore any requests without a command or from ourself
		if (!request.command || request.source == "background") return;
		
		// Pass through cross events (ie. contentscript -> popup, vise-versa)
		if (sender.tab && sender.tab.id == gsTabs[0]) { // Check that only events from the first open tab 
			sendRequest(request,'extension',true);
		} else if (gsTabs.length > 0) {                 // Only send events to the first open tab (if available)
			sendRequest(request,'tab',true);
		}
		
		// Handle commands - note that this is not all the commands, merely ones that the background page needs to do something with
		switch (request.command) {
	        // This is sent each time a popup is open, we give some initialisation settings such as enabled, tabId, etc.
			case 'popupInit':
				if (debug) console.log('Got popup init, re-checking tabs');
				get_gs_tab(function(notification){return function(){ //success (at least one open tab)
					sendRequest({"command":"popupUpdate","enabled":gsTabContentScriptLoaded,"tabId":gsTabs[0],"pinnedPopupOpen":pinnedPopupOpen,"includeNotification":notification},'extension');
					sendRequest({"command":"updateStatus"},'tab');
				};}(request.notification),function(notification){ return function(){ // fail (no open tab)
				    if (getSetting('newTabOnPopupClick')) {
				        open_gs_tab();
					    sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":true,"includeNotification":notification},'extension');
				    } else {
					    sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":false,"includeNotification":notification},'extension');
				    }
				    gsTabContentScriptLoaded = false;
				};}(request.notification));
				break;
            
            // This is sent when Grooveshark is closing (or has closed)					
			case 'gsTabClosing':
			    sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":false,"includeNotification":true},'extension');
			    chrome.browserAction.setTitle({"title":"SharkZapper"});
			    gsTabContentScriptLoaded = false;
			    break;
			
			// This is sent from the popup to open the current grooveshark tab or create a new one
			// The url is appended to the end http://listen.grooveshark.com/
			case 'openGSTab':
				get_gs_tab(open_gs_tab,open_gs_tab,request.url);
				break;
				
			// This is sent from a content script to check how many tabs are currently open
			// This message is sent to ALL grooveshark tabs EXCEPT the first, so other tabs can display a warning
			case 'getTabCount':
				get_gs_tab(function(){sendRequest({"command":"tabCount", "tabCount": gsTabs.length},'othertabs')});
				break;
				
			// This is sent from a content script to open the current grooveshark tab AND close the sender's tab
			case 'firstTabNavigate':
				chrome.tabs.remove(sender.tab.id);
				open_gs_tab();
				break;
				
			// This is sent from a content script whenever grooveshark sends a notification
			// Notifications are queued into notifications array, and only display for 5000ms
			case 'notification':
				chrome.tabs.get(gsTabs[0], function(request){ return function(tab){
					if (tab.selected) return; //ignore notifications if tab is open
					if (window.webkitNotifications) {
						notification = window.webkitNotifications.createNotification('','',request.message); 
						notification.ondisplay = function() { setTimeout(function(){ notifications.shift().cancel();}, 5000); };
						notification.show();
						notifications.push(notification);
					}
				}}(request));
				break;
				
			// This is sent from a popup to "pin" the popup by creating a long-living HTML notification
			case 'pinPopup':
			    if (!pinnedPopupOpen && window.webkitNotifications) {
			        pinnedPopup = window.webkitNotifications.createHTMLNotification('sharkzapper_popup.html#notification');
			        pinnedPopup.ondisplay = function(){pinnedPopupOpen = true;};
			        pinnedPopup.onclose = function(){pinnedPopupOpen = false;};
			        pinnedPopup.show();
			    }
			    break;
		    
		    // This is sent from a content script many times a second. Most processing for this is done in the popup,
		    // however we also set the title of the browser action to the song / artist name
		    case 'statusUpdate':
		        if (lastSong && request.currentSong && request.currentSong.SongName == lastSong.SongName && request.currentSong.ArtistName == lastSong.ArtistName && request.currentSong.AlbumName == lastSong.AlbumName) return;
		        if (request.currentSong && request.currentSong.SongName) {
			        chrome.browserAction.setTitle({"title":request.currentSong.SongName + "\n" + request.currentSong.ArtistName});
			        if (window.webkitNotifications && getSetting("showNotificationOnSongChange")) {
			            for (i in songNotifications) {
			                songNotifications.shift().cancel();
			            }
						notification = window.webkitNotifications.createNotification((request.currentSong.CoverArtFilename) ? request.currentSong.artPath + 'm' + request.currentSong.CoverArtFilename : defaultAlbumArtUrl,request.currentSong.SongName,request.currentSong.ArtistName); 
						notification.ondisplay = function() { setTimeout(function(){ songNotifications.shift().cancel();}, 5000); };
						notification.show();
						songNotifications.push(notification);
					}
		        } else { 
                    chrome.browserAction.setTitle({"title":"sharkZapper"});
                }
                lastSong = request.currentSong;
                break;
                
            // This is sent from a content script when the interactionTime popup appears
            // We then recreate this popup as a notification to ensure the user sees it
            case 'interactionTimePrompt':
                if (!interactionPopupOpen && window.webkitNotifications) {
                    interactionPopup = window.webkitNotifications.createHTMLNotification('sharkzapper_interactiontime.html');
                    interactionPopup.ondisplay = function(){interactionPopupOpen = true;};
			        interactionPopup.onclose = function(){interactionPopupOpen = false;};
			        interactionPopup.show();
                }
                break;
                
            // This is sent from the interactionTime notification when the user clicks "Resume"
            case 'interactionTimeResume':
                if (interactionPopupOpen) interactionPopup.cancel();
                break;
                
            // This is sent from a content script when it needs to load a (local) view file
            case 'fetchView':
                if (!request.viewName) { console.error("Cannot fetch view - no viewName specified"); }
                var xhr = new XMLHttpRequest();
                xhr.open("GET",chrome.extension.getURL(request.viewName + '.ejs'));
                xhr.onreadystatechange= function(request){
                    return function() {
                        if (xhr.readyState == 4) {
                            if (xhr.responseText) {
                                response = request;
                                response.command = 'viewUpdate';
                                response.view = xhr.responseText;
                                sendRequest(response, 'tab');
                            } else {XMLHttpRequest
                                console.error("Could not fetch "+request.viewName + '.ejs',xhr);
                            }
                        }
                    }
                }(request);
                xhr.send();
                break;
                
            // This is sent from a content script when it loads - we just send its settings
            case 'contentScriptInit':
                gsTabContentScriptLoaded = true;
                if (!localStorage.settings) return;
                sendRequest({"command":"settingsUpdate","settings":JSON.parse(localStorage.settings)},'tab');
                break;
            
            // This is sent to get all the settings
            case 'fetchSettings':
                if (!localStorage.settings) return;
                request.command = "settingsUpdate";
                request.settings = JSON.parse(localStorage.settings);
                sendRequest(request,'tab');
                break;
            
            // This is sent from a content script when it updates settings and we save the settings to localStorage
            case 'settingsUpdate':
                localStorage.settings = JSON.stringify(request.settings);
                if (debug) console.log ("Saved Settings!",request.settings);
                break;
                
            // This is sent to get a single setting, and sends the response directly back (requires callback on sender)
            case 'getSetting':
                if (!request.settingName) return;
                sendResponse(getSetting(request.settingName));
		}
	}
);

// We pass all requests through here so all requests can be easily debugged
function sendRequest(request,dest,dontModifySource) {
    if (!dontModifySource) request.source = "background";
    switch (dest) {
        case 'extension':
            chrome.extension.sendRequest(request); 
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">E>",request.command,request);
			break;
		case 'tab':
		    chrome.tabs.sendRequest(gsTabs[0], request); 
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">T>",request.command,request);
			break;
		case 'othertabs': // all tabs except first (active) tab
		    for (i=1;i<gsTabs.length;i++) {
				chrome.tabs.sendRequest(gsTabs[i], request);
			}
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">OTHERT>",request.command, request);
			break;
		case 'alltabs': // all tabs including first (active) tab
		    for (i=0;i<gsTabs.length;i++) {
				chrome.tabs.sendRequest(gsTabs[i], request);
			}
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">ALLT>",request.command, request);
			break;
        default:
            console.error('sendRequest called with unknown destination:',dest);
            break;
    }
}

// simple function to make a callback that sends a request - see popupInit code
function respond_callback(response,dest,dontModifySource) {
	return function(){sendRequest(response,dest,dontModifySource)};
}

function create_contextmenu() {
    if (!contextMenu.prev) contextMenu.prev=chrome.contextMenus.create({title:'Previous Song',contexts:['all'],onclick:contextmenu_callback});
    if (!contextMenu.playPause) contextMenu.playPause=chrome.contextMenus.create({title:'Play/Pause',contexts:['all'],onclick:contextmenu_callback});
    if (!contextMenu.next) contextMenu.next=chrome.contextMenus.create({title:'Next Song',contexts:['all'],onclick:contextmenu_callback});	    
}

function contextmenu_callback(info, tab) {
    var action = null;
    for (key in contextMenu) {
        if (contextMenu[key] == info.menuItemId) {
            action = key;
            break;
        }
    }
    if (debug) console.log("Context menu clicked",action,info,tab);
    switch (action) {
        case 'prev':
            sendRequest({command:"prevSong"},'tab');
            break;
        case 'playPause':
            sendRequest({command:"togglePlayPause"},'tab');
            break;
        case 'next':
            sendRequest({command:"nextSong"},'tab');
            break;
    }
}

// Inject all currently open tabs with our content script
get_gs_tab(inject_scripts); 
