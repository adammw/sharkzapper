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
 //TODO: Hook into status updates and set extension title on currently playing song, show notifications on song change, etc.
/**
 * Creates main sharkzapper background object
 *
 * @this {SharkZapperBackground}
 * @version 1.4.3
 * @param {Boolean} debug
 */
function SharkZapperBackground(debug){
    const isChrome = ('object' === typeof chrome);
    const isFirefox = !isChrome;
    const isSafari = false;
    if (debug) console.log('isChrome',isChrome,'isFirefox',isFirefox,'isSafari',isSafari);

	var sharkzapper = this;
	sharkzapper.version = '1.4.3';
    
    sharkzapper.setDebugLevel = function(l) {
        debug = 1; // Always debug sending out setDebugLevel
        sharkzapper.message.send({"command": "setDebugLevel", "level": l}, 'allports');
        debug = l;
        return debug;
    }

    /** compat hacks **/
    var localStorage = (isChrome) ? window.localStorage : require("simple-storage").storage;
    if (isFirefox) {
        var getURL = require("self").data.url;
    }
	
    if (isChrome) {
	    /**
	     * @constructor
	     */
	    var SharkZapperPort = function(port) {
	    	this.port = port;
	    }
	   	SharkZapperPort.prototype.__defineGetter__('onMessage', function() { return this.port.onMessage; });
	   	SharkZapperPort.prototype.__defineGetter__('onDisconnect', function() { return this.port.onDisconnect; });
	    SharkZapperPort.prototype.__defineGetter__('name', function() { return this.port.name; });
	    SharkZapperPort.prototype.send = function(data) {
		    if(debug) console.log("sharkzapper:",">PORT:"+this.name+">",data.command, data);
		    this.port.postMessage(data);
	    };
	    SharkZapperPort.prototype.disconnect = function() {
		    if(debug) console.warn("disconnecting "+this.name+" port");
		    this.port.disconnect();
	    };
    } else if (isFirefox) {
        /**
	     * @constructor
	     */
        var SharkZapperPort = function(name,worker) {
            var self = this;
            this.name = name;
            this.worker = worker;
            this.worker.port.on('message', this.onMessage.bind(this));
            this.worker.on('detach', this.onDisconnect.bind(this));
            this.listeners = {onMessage: [], onDisconnect: []};
            this.onMessage.addListener = function(fn) {
                self.listeners.onMessage.push(fn);
            };
            this.onDisconnect.addListener = function(fn) {
                self.listeners.onDisconnect.push(fn);
            };
	    }
        SharkZapperPort.prototype.send = function(data) {
            if(debug) console.log("sharkzapper:",">PORT:"+this.name+">",data.command, data);
            this.worker.port.emit("message", data);
        };
        SharkZapperPort.prototype.disconnect = function() {
            this.worker.destroy();
        };
        SharkZapperPort.prototype.onMessage = function(msg) {
            this.listeners.onMessage.forEach(function(fn) {
                fn.call(null, msg);
            });
        };
        SharkZapperPort.prototype.onDisconnect = function() {
            this.listeners.onDisconnect.forEach(function(fn) {
                fn.call();
            });
        };
    }
	
	
	/* Settings Namespace */
	sharkzapper.settings = {
		version: 9,
		defaults: {
			"newTabOnPopupClick": true,
			"showContextMenu": true,
			"showMuteButton": true,
			"showQueuePosition": true,
			"showQueueButtons": true,
			"showPlaybackButtons": true,
			"showNotificationOnSongChange": false,
			"showSearchBox": true,
			"showVolumeControlOnHover": true,
			"showAlbumArt": true,
			"enableSharkzapperMobile": false
		},
		
		/**
		 * Checks if settings are present or need upgrading to latest version
		 */
		upgrade: function upgrade_settings() {
			// Create settings with defaults
			if (!localStorage.settings || localStorage.settingsVersion < sharkzapper.settings.version) {
				if (!localStorage.settings) {
					localStorage.settings = JSON.stringify(sharkzapper.settings.defaults);
					localStorage.settingsVersion = sharkzapper.settings.version;
				} else {
					//do upgrade!
					var updatedSettings = JSON.parse(localStorage.settings);
					for (key in sharkzapper.settings.defaults) {
						if (!updatedSettings[key]) updatedSettings[key] = sharkzapper.settings.defaults[key];
					}
					// add specific setting changeovers here
					
					// store changes
					localStorage.settings = JSON.stringify(updatedSettings);
					localStorage.settingsVersion = sharkzapper.settings.version;
				}
			}
		},
		/**
		 * Fetches all settings
		 */
		fetchAll: function fetch_all_settings() {
			sharkzapper.settings.upgrade();
			return JSON.parse(localStorage.settings);
		},
		/**
		 * Fetches a single setting 
		 * @param {string} settingName
		 */
		fetch: function fetch_setting(settingName) {
			try {
				return JSON.parse(localStorage.settings)[settingName];
			} catch(e) {
				return defaultSettings[settingName];
			}
		},
		/**
		 * Stores new settings
		 * @param {Object} settings
		 */
		update: function update_settings(settings) {
			localStorage.settings = JSON.stringify(settings);
			
			if (settings.showContextMenu) {
				sharkzapper.contextMenu.create();
			} else {
				sharkzapper.contextMenu.destroy();
			}
		}
	};
	
	/* Listeners Namespace */
	sharkzapper.listeners = {
		bind: function bind_listeners() {
            if (isChrome) {
			    chrome.extension.onRequest.addListener(sharkzapper.listeners.request);
			    chrome.extension.onConnect.addListener(sharkzapper.listeners.connect);
            }
		},
		unbind: function unbind_listeners() {
            if (isChrome) {
			    chrome.extension.onRequest.removeListener(sharkzapper.listeners.request);
			    chrome.extension.onConnect.removeListener(sharkzapper.listeners.connect);
            }
		},
		//TODO: error handlers
		request: function handle_request(request, sender, sendResponse) {
            sharkzapper.message.recieve(request, sender, sendResponse);
        },
		connect: function handle_connect(port) {
			sharkzapper.message.connect(new SharkZapperPort(port));
		}
	};
	
	/* Message Namespace */
	sharkzapper.message = {
		ports: {
			popup: []
		},
		/** 
		 * Called when a Port is connected
		 * @param {SharkZapperPort} port
		 */
		connect: function(port) {
			if(debug) console.log("port",port.name,"connected",port);
			switch(port.name) {
				case 'contentScript':
					if (sharkzapper.message.ports.contentScript) {
						port.send({command: "cleanUp", showTabWarning: true});
						port.disconnect();
					} else {
						sharkzapper.message.ports.contentScript = port;
						port.send({command: "contentScriptUpdate", version: sharkzapper.version});
						sharkzapper.resources.fetch('js/sharkzapper_inject.js', function(script) {
							port.send({command: "injectScript", script: script});
						});
						port.onMessage.addListener((function create_port_listener (port) {
							return function port_listener(msg){
								sharkzapper.listeners.request(msg, {port: port});
							}
						})(port));
						port.onDisconnect.addListener(function disconnect_listener() {
							if(debug) console.warn('port',port.name,'disconnected',port);
							sharkzapper.message.ports.contentScript = null;
                            if (isChrome) {
							    chrome.browserAction.setTitle({"title":"sharkZapper"});
							    if (sharkzapper.contextMenu.handles.curSong) 
								    chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: 'Open Grooveshark'});
                            }
						});
					}
					break;
				case 'settings':
					//TODO
				case 'popup':
					sharkzapper.message.ports.popup.push(port);
					port.send({command: "settingsUpdate", settings: sharkzapper.settings.fetchAll()});
					port.send({command: "popupUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen});

					port.onMessage.addListener((function create_port_listener (port) {
						return function port_listener(msg){
							sharkzapper.listeners.request(msg, {port: port});
						}
					})(port));
					port.onDisconnect.addListener(function disconnect_listener() {
						if(debug) console.warn('port',port.name,'disconnected',port);
						sharkzapper.message.ports.popup.splice(sharkzapper.message.ports.popup.indexOf(port),1);
					});
					if (sharkzapper.message.ports.contentScript) {
						sharkzapper.message.ports.contentScript.send({command: "updateStatus"});
					} else {
						//TODO: tab not open, open tab if setting set
					}
					break;
				default:
					console.warn("Unhandled port: ", port.name, port);
					port.disconnect();
					break;
			}
		},
		/**
		 * Send a request
		 *
		 * @param request: data to be sent
		 * @param dest: destination
		 */
		send: function message_send(request, dest) {
            if (!isChrome) { throw new Error("Not Implemented"); }

            //TODO: rewrite and clean up (but remember to test old things like external commands)
			if (sharkzapper.message.ports.hasOwnProperty(dest)) {
				if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">PORT:" +sharkzapper.message.ports[dest].name +">",request.command, request);
				if (sharkzapper.message.ports[dest] instanceof Array) {
					for (i=0;i<sharkzapper.message.ports[dest].length;i++) {
						sharkzapper.message.ports[dest][i].postMessage(request);
					}
				} else {
					sharkzapper.message.ports[dest].postMessage(request);
				}
				return;
			} 

			switch (dest) {
				case 'extension':
					chrome.extension.sendRequest(request); 
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">E>",request.command,request);
					break;
				case 'tab':
					chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[0], request); 
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">T>",request.command,request);
					break;
				case 'othertabs': // all tabs except first (active) tab
					for (i=1;i<sharkzapper.tabs.openTabIds.length;i++) {
						chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[i], request);
					}
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">OTHERT>",request.command, request);
					break;
				case 'alltabs': // all tabs including first (active) tab
					for (i=0;i<sharkzapper.tabs.openTabIds.length;i++) {
						chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[i], request);
					}
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">ALLT>",request.command, request);
					break;
                case 'allports':
                    for (var dest in sharkzapper.message.ports) {
                        if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">PORT:" +sharkzapper.message.ports[dest].name +">",request.command, request);
                        if (sharkzapper.message.ports[dest] instanceof Array) {
                            for (i=0;i<sharkzapper.message.ports[dest].length;i++) {
                                sharkzapper.message.ports[dest][i].postMessage(request);
                            }
                        } else {
                            sharkzapper.message.ports[dest].postMessage(request);
                        }
                    }
                    break;
				default:
					console.error('sendRequest called with unknown destination:',dest);
					break;
			}
		},
		recieve: function message_recieve(request, sender) {
            if (!isChrome) { throw new Error("Not Implemented"); }

			// Determine sender
			var senderName = (sender.tab && sender.tab.id) ? 'TAB:'+sender.tab.id : (sender.id && !sender.tab) ? 'EXTENSION' : (sender.port) ? 'PORT:'+sender.port.name : 'UNK';
			sendResponse = function unknown_sender(msg) { console.error('Could not send response, unknown sender', msg); };
			if (sender && sender.port) {
				sendResponse = function respond_to_port(msg) { 
					if (debug) console.log("sharkzapper:",">PORT:" + sender.port.name + ">",request.command,request);
					sender.port.postMessage(msg); 
				}
			} else if (sender && sender.tab && sender.tab.id) {
				sendResponse = function respond_to_tab(msg) {
					if (debug) console.log("sharkzapper:",">TAB:" + sender.tab.id + ">",request.command,request);
					chrome.tabs.sendRequest(sender.tab.id, msg);
				}
			} else if (sender && sender.id && !sender.tab) {
				sendResponse = function respond_to_extension(msg) {
					if (debug) console.log("sharkzapper:",">EXTENSION>",request.command,request);
					chrome.extension.sendRequest(msg);
				}
			}
			
			// Do something about the request
			if (debug) console.log("sharkzapper:","<"+senderName+"<",request.command,request);
			switch(request.command) {
				case 'pinPopup':
					sharkzapper.popup.pin();
					break;	
					
				case 'unpinPopup':
					sharkzapper.popup.unpin();
					break;	
				
				case 'firstTabNavigate':
					if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) return;
					if (sender.tab && sender.tab.id)
						sharkzapper.tabs.remove(sender.tab.id);
					sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
					break;
					
				case 'openGSTab':
					if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) {
						var url = (request.url) ? "http://grooveshark.com/" + request.url : "http://grooveshark.com/";
						sharkzapper.tabs.open(url);
					} else {
						if (request.url)
							sharkzapper.tabs.navigate(sharkzapper.message.ports.contentScript.tab.id, request.url);
						sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
					}
					break;
					
				case 'fetchScript':
					sharkzapper.resources.fetch('js/sharkzapper_inject.js', function(script) {
						sendResponse({command: "injectScript", script: script});
					});
					break;
				case 'fetchSettings':
					sendResponse({command: "settingsUpdate", settings: sharkzapper.settings.fetchAll()});
					break;
					
				case 'openPopup':
                    if ('object' === typeof window) window.open(request.url, '', request.features);
					break;
				
				case 'statusUpdate':
					sharkzapper.status.update(request);
					sharkzapper.message.proxyToPopups(request);
					break;
					
				case 'settingsUpdate':
					if (request.settings)
						sharkzapper.settings.update(request.settings);
					sharkzapper.message.proxyToPopups(request);
					break;
					
				// Messages to proxy to contentscript
				case 'prevSong':
				case 'pauseSong':
				case 'playSong':
				case 'resumeSong':
				case 'nextSong':
				case 'voteSong':
				case 'updateStatus':
				case 'toggleMute':
				case 'togglePlayPause':
				case 'performSearch':
				case 'addToLibrary':
				case 'removeFromLibrary':
				case 'addToSongFavorites':
				case 'removeFromSongFavorites':
				case 'toggleSmile':
				case 'toggleFrown':
				case 'interactionTimeResume':
				case 'settingsUpdate':
				case 'viewUpdate':
				case 'volumeUpdate':
				case 'setShuffle':
				case 'setCrossfadeEnabled':
				case 'setRepeat':
					if (sharkzapper.message.ports.contentScript) {
						sharkzapper.message.ports.contentScript.send(request);
					}
					break;
				default:
					console.warn("Unhandled request: ", request.command, request);
			}
		},
		proxyToPopups: function(request) {
			for (i in sharkzapper.message.ports.popup) {
				sharkzapper.message.ports.popup[i].send(request);
			}
		}
	};
	
	sharkzapper.status = {
		cached: {},
		update: function status_update(status) {
			var songChange = false;
			var songClear = false;
			try {
				// Check if the song has changed (or has been cleared)
				if (status && status.hasOwnProperty('playbackStatus')) {
					if (status.playbackStatus && status.playbackStatus.hasOwnProperty('activeSong')) {
						if (!sharkzapper.status.cached.playbackStatus ||
							!sharkzapper.status.cached.playbackStatus.activeSong || 
							(status.playbackStatus.activeSong.hasOwnProperty('SongName') &&
								(status.playbackStatus.activeSong.SongName != sharkzapper.status.cached.playbackStatus.activeSong.SongName || 
								!sharkzapper.status.cached.playbackStatus.activeSong.SongName)
							) ||
							(status.playbackStatus.activeSong.hasOwnProperty('ArtistName') && 
								(status.playbackStatus.activeSong.ArtistName != sharkzapper.status.cached.playbackStatus.activeSong.ArtistName ||
								!sharkzapper.status.cached.playbackStatus.activeSong.ArtistName)
							) ||
							(status.playbackStatus.activeSong.hasOwnProperty('AlbumName') && 
								(status.playbackStatus.activeSong.AlbumName != sharkzapper.status.cached.playbackStatus.activeSong.AlbumName ||
								!sharkzapper.status.cached.playbackStatus.activeSong.AlbumName)
							)
						) 
						{
							 songChange = true;
						}
					} else if (!status.playbackStatus && sharkzapper.status.cached.playbackStatus) {
						songClear = true;
						sharkzapper.status.cached.playbackStatus = status.playbackStatus;
					}
				}
					
				sharkzapper.status.cached.playbackStatus = sharkzapper.status.undelta(status.playbackStatus, sharkzapper.status.cached.playbackStatus);
				if (isChrome && songChange && sharkzapper.status.cached.playbackStatus.activeSong && sharkzapper.status.cached.playbackStatus.activeSong.SongName) {
					if (debug) console.warn('songChange', sharkzapper.status.cached.playbackStatus.activeSong.SongName, sharkzapper.status.cached.playbackStatus.activeSong.ArtistName, sharkzapper.status.cached.playbackStatus.activeSong.AlbumName);
					chrome.browserAction.setTitle({"title": "sharkZapper:\n" + sharkzapper.status.cached.playbackStatus.activeSong.SongName + "\n" + sharkzapper.status.cached.playbackStatus.activeSong.ArtistName + "\n" + sharkzapper.status.cached.playbackStatus.activeSong.AlbumName});
					if (sharkzapper.contextMenu.handles.curSong) 
						chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: "Now Playing: " + sharkzapper.status.cached.playbackStatus.activeSong.SongName + " - " + sharkzapper.status.cached.playbackStatus.activeSong.ArtistName});
					sharkzapper.notifications.songChange(sharkzapper.status.cached.playbackStatus.activeSong);
				}
				if (songClear && isChrome) {
					if (debug) console.warn('songClear');
					chrome.browserAction.setTitle({"title":"sharkZapper"});
					if (sharkzapper.contextMenu.handles.curSong) 
						chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: 'Open Grooveshark'});
				}
			} catch (e) {
				console.warn('status_update_err:', e, e.stack);
			}
		},
		undelta: function (new_data, old_data) {
			return (function calc_undelta(new_data, old_data) {
				var undelta_data = {};
				if (old_data) {
					for (i in old_data) {
						undelta_data[i] = old_data[i];
					}
				}
				for (i in new_data) {
					if (typeof new_data[i] == 'object' && old_data && old_data.hasOwnProperty(i)) {
						undelta_data[i] = calc_undelta(new_data[i], old_data[i]); 
					} else {
						undelta_data[i] = new_data[i];
					}
				}
				return undelta_data
			})(new_data, old_data);
		}
	};
	
	/* Tabs Namespace */
	sharkzapper.tabs = {
		/** @private */
        openTabs: [],
		injectScripts: ['js/jquery.min.js', 'js/sharkzapper_contentscript.js'],
        contentScriptWorkers: [],
        /** 
         * Initalise tab functions / content scripts 
         */
        init: function() {
            if (isFirefox) {
                sharkzapper.tabs.pageMod = require("page-mod").PageMod({
	                include: '*.grooveshark.com',
	                contentScriptWhen: 'ready',
	                contentScriptFile: getURL('js/sharkzapper_contentscript.js'),
                    onAttach: function(worker) {
                        //TODO: Filter out iframes, non-player pages, etc.
                        console.log("New Firefox PageMod Worker", worker.url, worker);
                        sharkzapper.message.connect(new SharkZapperPort('contentScript',worker));
                        sharkzapper.tabs.contentScriptWorkers.push(worker);
                        worker.on('detach', function () {
                            var index = sharkzapper.tabs.contentScriptWorkers.indexOf(worker);
                            if(index != -1) {
                                sharkzapper.tabs.contentScriptWorkers.splice(index, 1);
                            }
                        });
                    }
                });
            }
        },
		/**
		 * Find all currently open Grooveshark tabs
		 *
		 * @param {Function} success_callback
		 * @param {Function} failure_callback
		 * @param {Object} callback arguments
		 */
		findAll: function find_all_tabs(success_callback, fail_callback, arg) {
            var callback_check = function() {
                if(sharkzapper.tabs.openTabs.length > 0 && typeof success_callback == "function") {
				    success_callback(arg);
			    } else if(typeof fail_callback == "function") {
				    fail_callback(arg);
			    }
            };

            if (isChrome) {
			    chrome.windows.getAll({'populate':true}, function(win) {
				    sharkzapper.tabs.openTabs = [];
				    for (wi in win) {
					    for (ti in win[wi].tabs) {
						    if(sharkzapper.tabs.checkUrl(win[wi].tabs[ti].url)) {
							    sharkzapper.tabs.openTabs.push(win[wi].tabs[ti].id);
						    }
					    }
				    }
				    callback_check();
			    });
            } else if (isFirefox) {
                var tabs = require('tabs');
                for (ti in tabs) {
                    if(sharkzapper.tabs.checkUrl(tabs[ti].url)) {
                        sharkzapper.tabs.openTabs.push(tab);
                    }
                }
                callback_check();
            }
		},
		/** 
		 * Checks if URL is a Grooveshark URL
		 *
		 * @param {string} URL
		 * @return {Boolean}
		 */
		checkUrl: function check_tab_url(url) {
			return Boolean(url.indexOf('http://preview.grooveshark.com/')==0 || url.indexOf('http://grooveshark.com/')==0);
		},
		/**
		 * Injects script into first currently open Grooveshark tab
		 */
		injectFirst: function injectFirst() {
			sharkzapper.tabs.findAll(function inject_callback() {
				if (sharkzapper.tabs.openTabs.length > 0) {
					sharkzapper.tabs.inject(sharkzapper.tabs.openTabs[0]);
				}
			});
		},
		/**
		 * Injects scripts into specified tab id
		 * @param {string/Object} Chrome Tab Id or Firefox Tab Object
		 */
		inject: function inject(tab) {
            if (!isChrome) throw new Error("Not Implemented");
			for (i in sharkzapper.tabs.injectScripts) {
                if (isChrome) {
    				chrome.tabs.executeScript(tab, {file: 'data/' + sharkzapper.tabs.injectScripts[i]});
                } else if (isFirefox) {
                    tab.attach({
                        contentScriptFile: getURL(sharkzapper.tabs.injectScripts[i])
                    }); 
                    //TODO add worker onAttach push to sharkzapper.tabs.contentScriptWorkers
                }
			}
			if (debug) console.log('Injected scripts into existing tab #' + tabId);
		},
		/**
		 * Brings specified tab into focus (assuming Chrome is focused)
		 */
		focus: function focus(tabId) {
            if (!isChrome) throw new Error("Not Implemented");
			chrome.tabs.update(tabId, {'selected':true});
		},
		/**
		 * Opens a tab 
		 * @param URL
		 */
		open: function open(url) {
            if (!isChrome) throw new Error("Not Implemented");
			chrome.tabs.create({url: url});
		},
		/**
		 * Closes tab
		 * @param {string} Chrome Tab Id
		 */
		remove: function remove(tabId) {
            if (!isChrome) throw new Error("Not Implemented");
			chrome.tabs.remove(tabId);
		},
		/**
		 * Navigates an existing tab to a new hash location
		 * @param {string} Chrome Tab Id
		 * @param {string} url hash fragment
		 */
		navigate: function(tabId,url) {
            if (!isChrome) throw new Error("Not Implemented");
			chrome.tabs.get(tabId, function(tab) {
				var base = (tab.url.indexOf('#') !== -1) ? tab.url.substring(0,tab.url.indexOf('#')) : tab.url;
				if (tab.url == base + url) return;
				chrome.tabs.update(tabId, {'url': base + url});
			});
		}
	};
	
	/* Context Menu Namespace */
	sharkzapper.contextMenu = {
		/** @private */
		handles: {},
		/**
		 * Creates the context menu items
		 */
		create: function create_context_menu() {
            if (isChrome) {
                var createContextMenus = chrome.contextMenus.create;
            } else if (isFirefox) {
                var cm = require("context-menu");
                var contextMenu = cm.Menu({
                    label: "sharkZapper",
                    items: []
                });
                var createContextMenus = function(data) {
                    var item = (data.type == 'separator') ? cm.Separator() : cm.Item({ 
                        label: data.title, 
                        contentScript: 'self.on("click", function() { self.postMessage("click"); });',
                        onMessage: data.onclick
                    });
                    contextMenu.items.push(item);
                    return item;
                };
            }
			if (!sharkzapper.contextMenu.handles.curSong) 
				sharkzapper.contextMenu.handles.curSong = createContextMenus({title:'Open Grooveshark', contexts:['all'], onclick: sharkzapper.actions.focusGS});
			if (!sharkzapper.contextMenu.handles.sep) 
				sharkzapper.contextMenu.handles.sep = createContextMenus({type:'separator', contexts:['all']});
			if (!sharkzapper.contextMenu.handles.prev) 
				sharkzapper.contextMenu.handles.prev = createContextMenus({title:'Previous Song', contexts:['all'], onclick: sharkzapper.actions.prev});
			if (!sharkzapper.contextMenu.handles.playPause) 
				sharkzapper.contextMenu.handles.playPause = createContextMenus({title:'Play/Pause', contexts:['all'], onclick: sharkzapper.actions.playPause});
			if (!sharkzapper.contextMenu.handles.next) 
				sharkzapper.contextMenu.handles.next = createContextMenus({title:'Next Song', contexts:['all'], onclick: sharkzapper.actions.next});	    
		},
		/** 
		 * Removes the context menu items
		 */
		destroy: function destroy_context_menu() {
            if (!isChrome) throw new Error("Not Implemented");
			for (i in sharkzapper.contextMenu.handles) {
				chrome.contextMenus.remove(sharkzapper.contextMenu.handles[i]);
				delete sharkzapper.contextMenu.handles[i];
			}
		}
	};
	
	/* Popup Namespace */
	sharkzapper.popup = {
		pinnedPopupOpen: false,
        init: function() {
            if (isFirefox) {
                sharkzapper.popup.panel = require("panel").Panel({
	                contentURL: getURL("html/sharkzapper_popup.html"),
                    width: 320,
                    height: 180,
                    /* TODO: size will change, it's probably best to set this from popup javascript */
                });
            }
        },
		pin: function() {
			if (!isChrome || sharkzapper.popup.pinnedNotification || !window.webkitNotifications) return;
			sharkzapper.popup.pinnedNotification = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('data/html/sharkzapper_popup.html#notification'));
			sharkzapper.popup.pinnedNotification.ondisplay = function(){
				sharkzapper.popup.pinnedPopupOpen = true;
				sharkzapper.message.send({command: "statusUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen, delta: true, cached: false}, 'popup');
			};
			sharkzapper.popup.pinnedNotification.onclose = function(){	
				sharkzapper.popup.pinnedPopupOpen = false;
				sharkzapper.popup.pinnedNotification = null;
				sharkzapper.message.send({command: "statusUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen, delta: true, cached: false}, 'popup');
			};
			sharkzapper.popup.pinnedNotification.show();
		},
		unpin: function() {
			if (!sharkzapper.popup.pinnedNotification) return;
			sharkzapper.popup.pinnedNotification.cancel();
		}
	};
	
	sharkzapper.notifications = {
		songNotifications: [],
		songChange: function (song) {
			if (isChrome && window.webkitNotifications && sharkzapper.settings.fetch("showNotificationOnSongChange")) {
				console.log(song);
				for (i in sharkzapper.notifications.songNotifications) {
					sharkzapper.notifications.songNotifications.shift().cancel();
				}
				notification = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('data/html/sharkzapper_songnotification.html#' + JSON.stringify(song)));
				//notification = window.webkitNotifications.createNotification((song.CoverArtFilename && song.artPath) ? song.artPath + 'm' + song.CoverArtFilename : 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png', song.SongName, song.ArtistName + "\n" + song.AlbumName); 
				notification.ondisplay = function(notification) { return function() { setTimeout(function(){ 
					if (sharkzapper.notifications.songNotifications.indexOf(notification) === -1) return notification.cancel();
					sharkzapper.notifications.songNotifications.splice(sharkzapper.notifications.songNotifications.indexOf(notification),1);
					notification.cancel();
				}, 5000); } }(notification);
				notification.show();
				sharkzapper.notifications.songNotifications.push(notification);
			}
		}
	};
	
	/* Resources Namespace */
	sharkzapper.resources = {
		fetch: function fetch(url, callback) {
            if (isChrome) {
			    var xhr = new XMLHttpRequest();
			    xhr.open("GET",chrome.extension.getURL('data/'+url));
			    xhr.onreadystatechange=function() {
				    if (this.readyState == 4) {
					    callback(xhr.responseText, url);
				    }
			    };
			    xhr.send();
            } else if (isFirefox) {
                callback(require("self").data.load(url), url);
            }
		}
	};
	
	/* Actions Namespace */
	sharkzapper.actions = {
		playPause: function playPause() {
			sharkzapper.message.send({command:"togglePlayPause"},'contentScript');
		},
		prev: function prev() {
			sharkzapper.message.send({command:"prevSong"},'contentScript');
		},
		next: function next() {
			sharkzapper.message.send({command:"nextSong"},'contentScript');
		},
		focusGS: function focusGS() {
			if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) {
				sharkzapper.tabs.open("http://grooveshark.com/");
			} else {
				sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
			}
		}
	};

    /* Browser Action / Widget Namespace */
    sharkzapper.browserAction = {
        init: function() {
            if (isFirefox) {
                if (!sharkzapper.popup.panel) sharkzapper.popup.init();
                sharkzapper.browserAction.widget = require("widget").Widget({
                    id: "sharkzapper",
                    label: "sharkZapper",
                    panel: sharkzapper.popup.panel,
                    contentURL: getURL("img/icon_19.png")
                });
            }
            sharkzapper.browserAction.setTitle("sharkZapper");
        },
        setTitle: function(title) {
            if (isChrome) {
                chrome.browserAction.setTitle({"title":title});
            } else if (isFirefox) {
                sharkzapper.browserAction.widget.label = title;
            }
        }
    };
    
	/**
	 * Performs any initalisation routines 
	 *
	 * @return {SharkZapperBackground} sharkzapper
	 */
	sharkzapper.init = function init() {
		sharkzapper.settings.upgrade();
		sharkzapper.listeners.bind();
		if (sharkzapper.settings.fetch("showContextMenu")) {
			sharkzapper.contextMenu.create();
		}
        sharkzapper.popup.init();
        sharkzapper.browserAction.init();
        sharkzapper.tabs.init();
		sharkzapper.tabs.injectFirst();
		return sharkzapper;
	}
	
	return sharkzapper.init();
}

if ('object' === typeof module) {
    module.exports = SharkZapperBackground;
} else {
    this.sharkzapper = new SharkZapperBackground(false) // debug = false
}
