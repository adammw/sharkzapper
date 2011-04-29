/*
 * sharkzapper_inject.js
 * This is the inject script for sharkZapper which handles all communication between Grooveshark's JS API and the content script
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
var sharkzapper = new (function SharkZapperPage(debug){
    var sharkzapper = this;
    sharkzapper.cache = {};
    sharkzapper.timers = {};
    sharkzapper.gs_ready = false;
    sharkzapper.gs_player_ready = false;
    sharkzapper.queue = {
        onReady: {
            callplayercheckonready: function callplayercheckonready() {
                sharkzapper.timers.playerCheck = setTimeout(sharkzapper.listeners.playercheck, 100);
            }
        },
        onPlayerReady: {}
    };
    sharkzapper.overrides = {
        init: function init_overrides() {
            sharkzapper.helpers.execWhenReady(function playerOverride() {
                sharkzapper.cache.playbackProperties = GS.player.player.setPropertyChangeCallback("sharkzapper.overrides.propertyChange");
            },'playerOverride','onPlayerReady');
        },
        undo: function undo_overrides() {
            GS.player.player.setPropertyChangeCallback("GS.Controllers.PlayerController.instance().propertyChange");  
        },
        listeners: {
            //This override would not be needed if Grooveshark had a $.publish("gs.player.propchange") on PlayerController.propertyChange
            propertyChange: function sharkzapper_handle_propertyChange(props) {
                $.publish("gs.player.propchange",props);
                GS.Controllers.PlayerController.instance().propertyChange.call(null, props);
            }
        }
    };
    sharkzapper.listeners = {
        subscriptions: {},
        bind: function bind_listners() {
            // DOM Events
            window.addEventListener("message", sharkzapper.listeners.message, false);
            
            // GS Events
            sharkzapper.listeners.subscriptions["gs.app.ready"] = $.subscribe("gs.app.ready", sharkzapper.listeners.ready);
            sharkzapper.listeners.subscriptions["gs.player.playstatus"] = $.subscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
            
            // Custom Events - see overrides
            sharkzapper.listeners.subscriptions["gs.player.propchange"] = $.subscribe("gs.player.propchange", sharkzapper.listeners.propchange);
            
            // Fake the gs.app.ready event (needed when injected after it has already fired)
            if (document.readyState == 'complete') {
                $(document).ready(function() {
                    setTimeout(function() {
                        if (!sharkzapper.gs_ready) {
                            if (debug) console.log('overriding gs.app.ready');
                            sharkzapper.listeners.ready();
                        } 
                    }, 200);
                });
            }
        },
        unbind: function unbind_listeners() {
            // DOM Events
            window.removeEventListener("message", sharkzapper.listeners.message);
            
            // GS Events
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.playstatus"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.propchange"]);
            if (sharkzapper.listeners.subscriptions["gs.app.ready"]) {
                $.unsubscribe(sharkzapper.listeners.subscriptions["gs.app.ready"]);
            }
            
            if (debug) console.log('unsubscribed from events');
        },
        error: function handle_error(e) {
            console.error('sharkzapper error:',e);
        },
        ready: function handle_ready() {
            sharkzapper.gs_ready = true;
            if (debug) console.log('sharkzapper: gs.app.ready');
            
            for (i in sharkzapper.queue.onReady) {
                try {
                    sharkzapper.queue.onReady[i].call();
                } catch(e) {
                    console.error('onready error:',e);
                }
                delete sharkzapper.queue.onReady[i];
            }
            
            // We only want the event once, async get rid of it
            setTimeout(function(){
                $.unsubscribe(sharkzapper.listeners.subscriptions["gs.app.ready"]);
            },0);
        },
        playercheck: function timer_playerCheck() {
            if (GS.player.player) {
                sharkzapper.gs_player_ready = true;
                if (debug) console.log('sharkzapper: we have GS.player.player');
                
                for (i in sharkzapper.queue.onPlayerReady) {
                    try {
                        sharkzapper.queue.onPlayerReady[i].call();
                    } catch(e) {
                        console.error('onplayerready error:',e);
                    }
                    delete sharkzapper.queue.onPlayerReady[i];
                }
                
                if (sharkzapper.timers.playerCheck) {
                    clearTimeout(sharkzapper.timers.playerCheck);
                    delete sharkzapper.timers.playerCheck;
                }
            } else {
                if (debug) console.log('sharkzapper: waiting for GS.player.player');
                sharkzapper.timers.playerCheck = setTimeout(timer_playerCheck, 500);
            }
        },
        message: function handle_message(e) {
            // Ignore external messages
            if (e.origin != location.origin) return;
            
            // Parse all messages as JSON
            var request = JSON.parse(e.data);
            
            // Prevent feedback
            if (request.source && request.source == 'page') return;
            
            // Pass to message.recieve
            sharkzapper.message.recieve(request);           
        }, 
        playstatus: function handle_playstatus(status, noDelta) {
            status = (noDelta) ? status : sharkzapper.helpers.delta(status, 'playbackStatus');
            sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": status, "cached": false, "delta": !Boolean(noDelta)});
        },
        propchange: function handle_propchange(status, noDelta) {
            status = (noDelta) ? status : sharkzapper.helpers.delta(status, 'playbackProperties');
            sharkzapper.message.send({"command": "statusUpdate", "playbackProperties": status, "cached": false, "delta": !Boolean(noDelta)});
        }
    };
    sharkzapper.message = {
        send: function message_send(data) {
            if (debug) console.log("sharkzapper:", ">P>", data);
            data.source = "page";
            if (debug) data.timestamp = (new Date()).valueOf();
            window.postMessage(JSON.stringify(data), location.origin);
        }, 
        recieve: function message_recieve(data) {
            if (debug) console.log("sharkzapper:", "<P<", data.command, data);
            switch(data.command) {
                // Command called by contentscript to clean up and prepare for re-injection
                case 'cleanUp':
                    sharkzapper.destroy();
                    break;
                    
                // Command called by popup to get a forced status update, usually cached but may be fresh if cache unavailable
                case 'updateStatus':
                    if (sharkzapper.cache.playbackStatus && sharkzapper.cache.playbackProperties) {
                        sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": sharkzapper.cache.playbackStatus, "playbackProperties": sharkzapper.cache.playbackProperties, "cached":true, "delta":false});
                    } else {
                        if (sharkzapper.cache.playbackStatus) {
                            sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": sharkzapper.cache.playbackStatus, "cached":true, "delta":false});
                        } else {
                            sharkzapper.helpers.execWhenReady(function updateStatus() {
                                sharkzapper.listeners.playstatus(GS.player.getPlaybackStatus(), true);
                            },'updateStatus');
                        }
                        if (sharkzapper.cache.playbackProperties) {
                            sharkzapper.message.send({"command": "statusUpdate", "playbackProperties": sharkzapper.cache.playbackProperties, "cached":true, "delta":false});
                        } else {
                            sharkzapper.helpers.execWhenReady(function updateProperties() {
                                sharkzapper.listeners.propchange(GS.player.player.setPropertyChangeCallback("sharkzapper.overrides.propertyChange"), true);
                            },'updateProperties','onPlayerReady');
                        }
                    }                
                    break;
                    
                /* Commands */
                case 'toggleMute':
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.setIsMuted(!Grooveshark.getIsMuted());
                    break;    
                case "togglePlayPause":
                    if (!sharkzapper.gs_ready) return;
	                
	                Grooveshark.togglePlayPause();
	                break;           
            }
        }
    };
    sharkzapper.helpers = {
        delta: function delta(new_data, key) {
            if (!sharkzapper.cache[key]) {
                sharkzapper.cache[key] = new_data;
                return new_data;
            } else {
                var old_data = sharkzapper.cache[key];
                var delta_data = (typeof new_data == 'object' && new_data != null) ? (function calc_delta(new_data, old_data) {
                    if (old_data == null) {
                        old_data = {};
                    }
                    var delta_data = {};
                    for (i in new_data) {
                        if (!old_data.hasOwnProperty(i) || new_data[i] != old_data[i]) {
                            if (typeof new_data[i] == 'object') {
                                delta_data[i] = calc_delta(new_data[i], old_data[i]); 
                            } else {
                                delta_data[i] = new_data[i];
                            }
                        }
                    }
                    return delta_data
                })(new_data, old_data) : new_data;
                sharkzapper.cache[key] = new_data;
                return delta_data;
            }
        },
        execWhenReady: function execWhenReady(func, key, queue) {
            if (typeof func != 'function') return;
            if (!queue || queue == 'onReady') {
                if (!sharkzapper.gs_ready) { 
                    sharkzapper.queue.onReady[key] = func;
                } else {
                    func.call();
                }
            } else if (queue == 'onPlayerReady') {
                if (!sharkzapper.gs_player_ready) { 
                    sharkzapper.queue.onPlayerReady[key] = func;
                } else {
                    func.call();
                }
            }
        }
    };
    sharkzapper.destroy = function destroy() {
        try {
            sharkzapper.listeners.unbind();
            sharkzapper.overrides.undo();
        } catch(e) {
            console.error('cleanUp error:', e);    
        }
        for (i in sharkzapper.timers) {
            try {
                clearTimeout(sharkzapper.timers[i]);
            } catch (e) {
                console.error('could not clearTimeout on',i,sharkzapper.timers[i],e);
            }
        }
        
        sharkzapper = null;
        delete window.sharkzapper;
    };
    sharkzapper.init = function init() {
        try {
            sharkzapper.listeners.bind();
        } catch (e) {
            sharkzapper.listeners.error(e);
        }
        sharkzapper.overrides.init();
        return sharkzapper_external;
    };
    var sharkzapper_external = new (function SharkZapper_ExternalInterface() {
        if (debug) this.internal = sharkzapper;
        this.overrides = sharkzapper.overrides.listeners;
    })();
    return this.init();
})(true);
