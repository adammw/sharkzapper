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
    var sharkzapper_external = new (function SharkZapper_ExternalInterface() {
        if (debug) this.internal = sharkzapper;
        
        
    })();
    sharkzapper.cache = {};
    sharkzapper.gs_ready = false;
    sharkzapper.queue = {
        onReady: {}
    };
    sharkzapper.listeners = {
        bind: function bind_listners() {
            // DOM Events
            window.addEventListener("message", sharkzapper.listeners.message, false);
            
            // GS Events
            $.subscribe("gs.app.ready", sharkzapper.listeners.ready);
            $.subscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
        },
        unbind: function unbind_listeners() {
            // DOM Events
            window.removeEventListener("message", sharkzapper.listeners.message);
            
            // GS Events
            $.unsubscribe("gs.app.ready", sharkzapper.listeners.ready);
            $.unsubscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
        },
        error: function handle_error(e) {
            console.error('sharkzapper error:',e);
        },
        ready: function handle_ready() {
            sharkzapper.gs_ready = true;
            
            for (i in sharkzapper.queue.onReady) {
                try {
                    sharkzapper.queue.onReady[i].call();
                } catch(e) {
                    console.error('onready error:',e);
                }
                delete sharkzapper.queue.onReady[i];
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
                case 'cleanUp':
                    sharkzapper.destroy();
                    break;
                case 'updateStatus':
                    if (sharkzapper.cache.playbackStatus) {
                        sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": sharkzapper.cache.playbackStatus, "cached":true, "delta":false});
                    } else if (!sharkzapper.gs_ready) {
                        sharkzapper.queue.onReady.updateStatus = function() {
                            sharkzapper.listeners.playstatus(GS.player.getPlaybackStatus(), true);
                        };
                    } else {
                        sharkzapper.listeners.playstatus(GS.player.getPlaybackStatus(), true);
                    }                
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
                var delta_data = (typeof new_data == 'object') ? (function calc_delta(new_data, old_data) {
                    var delta_data = {};
                    for (i in new_data) {
                        if (new_data[i] != old_data[i]) {
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
        }
    };
    sharkzapper.destroy = function destroy() {
        try {
            sharkzapper.listeners.unbind();
        } catch(e) {
            console.error('cleanUp error:', e);    
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
        
        return sharkzapper_external;
    };
    return this.init();
})(true);
