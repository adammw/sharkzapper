/*
 * sharkzapper_inject.js
 * This is the inject script for sharkZapper which handles all communication between Grooveshark's JS API and the content script
 *
 * sharkZapper is Copyright (C) 2010-2012 Adam Malcontenti-Wilson <adman.com@gmail.com>
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
            // Override propertychange / queuechange callbacks to provide events
            sharkzapper.helpers.execWhenReady(function playerOverride() {
                sharkzapper.overrides.originals["GS.player.voteSong"] = GS.player.voteSong;
                GS.player.voteSong = sharkzapper.overrides.listeners.voteSong;
                sharkzapper.cache.playbackProperties = GS.player.player.setPropertyChangeCallback("sharkzapper.overrides.propertyChange");
                GS.player.player.setQueueChangeCallback("sharkzapper.overrides.queueChange");
            },'playerOverride','onPlayerReady');
            
            // fetch user views and modify settings_index to include a link 
            sharkzapper.helpers.execWhenReady(function fetchUserViews() {
                //TODO: check if it's too late to use preCached / check if settings are already open
                //TODO: implement undo behaviour
                if(debug) console.log('loading user views');
                $.ajax({
                    contentType: "application/json",
                    dataType: "json",
                    type: "GET",
                    url: "/gs/views/user.json",
                    async: true,  
                    cache: true,
                    success: function(views) {
                        if (views) {
                            _.forEach(views, function (view, key) {
                                if (key == "gs_views_settings_index_ejs") {
                                    // Inject our link
                                    view = view.replace(/(<ul id="settings_sections"[\s\S]+?)<\/ul>/,'$1\n<li class="pane pane_sharkzapper">\n<a onclick="sharkzapper.openSettings()">\n<span class="icon" style="background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9oMFwQbH1R4eX0AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAD0klEQVQ4y12Ma0xbZRiA3+/raSstlN7g2CMUjkw3wyUkmzNGUG6Zi4kLUVzikvnHaNwPxJgxw7YfExRMiEYzjcmSZUFINLqAYzNmXEK7hEi5lQK6gfQCraO0PaelLaftTr/z+WuJ8fn9PA+ilML/UC/Ozx+z2WxX8vl8myzLkM1kprx+f+/LjY1LxSZTHmP82EXoPwPk83rrY7FYTyAQeN0fCEQT8biAEAKDwWBhWdZmNBjGKFUG33jrtPtkW/WR7k8GvMzj+u+NjfZlt/vH5eXlv9xud9fU9PTd6tpa4ZmqKiaeSNitZnNLJc+/V2otcXz+WXdPal8s8Xk3v0SUUlhbXa1dWFhwORyOW8MjIx85Z2a+D4VCCzaOu9Hc0hIGAC0AkM7OztqDtDT4dOlua1UZfvXtzjuzeDsQ0KytrV1aXFxc83g8Fyiley6X65XAzk7fPadz8vq1ay8BAKaUFn519arvqGnuZyUpwoSbPbu+vv4E/nV09LB3a6tjZWXlhmd1NQgAkE6n8zzPq8wWS83c/Pyty5cuPo8QUt/84p3ntKL/ikTtc3lZPnN7fPwQlvP5T7e83pB/e3saAGB8bMxCAayiKIK19ElaZ0MWYXPGefliDx+V/hgqrWFnsa3tW7WayblcrvP44e7uqb29PUEBCAIAxATh7IEkYUmSqH/rPmo4rqa9fdVgZqfGT5+zW35Z6ek7XlcS0mo00VQq9Rr+JxTCuVyuoLWpqczjdp/YCQbPp5JJEMUEwvkQVNUzqISX6MddRravl0SHR973FxcXazVarSqbzWKV0Wh8IZvLvchxXPvG5uYZr8/H6vWFFIOETjYQcDgfQpU+jabvIph2mYoWXLMNusLC5o0HD2oi0eiEymKx3Jdl+V1FUUyiKBYwDAOZTAaZtTE4ZH0EP/yuhfpjMbh+00qLjEZGEMXKcDhcEY/HSXl5+Qe4sqLiz/1EYkwUBMhkMlQQBJCScWh/9gC+/kkCxBA4140hJSkoLopACAGMMUiSdKerq2sDUUqx3W4/SgiZsFqtRlnG9MMOM9rZxTC1ngWdVgUMw4Asy4AQok9xHMpks/tFRUVvDg0NuTEAwOjo6AohpDMcjiaO8DkUjKdheDIIqUSURiIRGolEACEELMsiKZNJJpPJC/39/R4AIIgQgjHGyOvbYVqamxoP2+XvgjE9r9Pp1QzDgEajAZ1OBwzDkFQqNclx3DcDAwOLPM8/opQqQCnFiqKoKKXMvd9uGwb7+6x1dXWnWJZ1chwnl5WVyXa73dHa2tqxtLTEEkJMlFKDoih6SmnBv/eM+oTo5p/0AAAAAElFTkSuQmCC) no-repeat;"></span>\n<span class="text">sharkZapper</span>\n<span class="arrow"></span>\n</a>\n</li>\n</ul>');
                                    
                                    // Insert our index
                                    $.View.preCached["gs_views_sharkzapper_settingsindex_ejs"] = view;
                                    $.publish("sharkzapper.settingsindexready");
                                }
                                $.View.preCached[key] = view;
                            });
                        }
                    },
                });
                /*if(debug) console.log('creating sharkzappercontroller class');
                GS.Controllers.PageController.extend("GS.Controllers.Page.SharkzapperController", {}, {
                    index: sharkzapper.listeners.sharkzapperPage
                });*/
            },'fetchUserViews');
        },
        undo: function undo_overrides() {
            GS.player.player.setPropertyChangeCallback("GS.Controllers.PlayerController.instance().propertyChange");  
            GS.player.player.setQueueChangeCallback("GS.Controllers.PlayerController.instance().queueChange");
            GS.player.voteSong = sharkzapper.overrides.originals["GS.player.voteSong"];
            if (debug) console.log('undid sharkzapper overrides');
        },
        listeners: {
            /*These overrides would not be needed if Grooveshark had a $.publish("gs.player.propchange") etc. on PlayerController.propertyChange etc.*/
            propertyChange: function sharkzapper_handle_propertyChange(props) {
                $.publish("gs.player.propchange",props);
                GS.Controllers.PlayerController.instance().propertyChange.call(null, props);
            },
            queueChange: function sharkzapper_handle_queueChange(queue) {
                $.publish("gs.player.queuechange",queue);
                GS.Controllers.PlayerController.instance().queueChange.call(null, queue);
            },
            /* Unfortunately GS provides gs.player.voted but it's useless as it doesn't say which song! */
            voteSong: function sharkzapper_handle_voteSong() {
                sharkzapper.overrides.originals["GS.player.voteSong"].apply(this, arguments);
                $.publish("gs.player.votesong",arguments);
            }
        },
        originals: {}
    };
    sharkzapper.listeners = {
        subscriptions: {},
        bind: function bind_listners() {
            // DOM Events
            window.addEventListener("message", sharkzapper.listeners.message, false);
            
            // GS Events
            sharkzapper.listeners.subscriptions["gs.app.ready"] = $.subscribe("gs.app.ready", sharkzapper.listeners.ready);
            sharkzapper.listeners.subscriptions["gs.player.playstatus"] = $.subscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
            sharkzapper.listeners.subscriptions["gs.auth.library.songsAdded"] = $.subscribe("gs.auth.library.songsAdded", sharkzapper.listeners.songsAddedToLibrary);
            sharkzapper.listeners.subscriptions["gs.auth.library.remove"] = $.subscribe("gs.auth.library.remove", sharkzapper.listeners.songRemovedFromLibrary);
            sharkzapper.listeners.subscriptions["gs.auth.favorites.songs.add"] = $.subscribe("gs.auth.favorites.songs.add", sharkzapper.listeners.songAddedToFavorites);
            sharkzapper.listeners.subscriptions["gs.auth.favorites.songs.remove"] = $.subscribe("gs.auth.favorites.songs.remove", sharkzapper.listeners.songRemovedFromFavorites);
            
            // Custom Events - see overrides
            sharkzapper.listeners.subscriptions["gs.player.propchange"] = $.subscribe("gs.player.propchange", sharkzapper.listeners.propchange);
            sharkzapper.listeners.subscriptions["gs.player.queuechange"] = $.subscribe("gs.player.queuechange", sharkzapper.listeners.queuechange);
            sharkzapper.listeners.subscriptions["gs.player.votesong"] = $.subscribe("gs.player.votesong", sharkzapper.listeners.votesong);

            
            // Fake the gs.app.ready event (needed when injected after it has already fired)
            $(document).ready(function() {
                setTimeout(function gschecker() {
                    if (!sharkzapper.gs_ready) {
                        if (window.GS) {
                            if (debug) console.log('overriding gs.app.ready');
                            sharkzapper.listeners.ready();
                        } else {
                            if (debug) console.log('no window.GS, will recheck in 200ms');
                            setTimeout(gschecker, 200);
                        }
                    } 
                }, 200);
            });
        },
        unbind: function unbind_listeners() {
            // DOM Events
            window.removeEventListener("message", sharkzapper.listeners.message);
            
            // GS Events
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.playstatus"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.propchange"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.queuechange"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.player.votesong"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.auth.library.songsAdded"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.auth.library.remove"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.auth.favorites.songs.add"]);
            $.unsubscribe(sharkzapper.listeners.subscriptions["gs.auth.favorites.songs.remove"]);

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
        playstatus: function handle_playstatus(status, noDelta, cached) {
            // Fix for odd queueReset behaviour
            if (status && status.activeSong && status.activeSong.SongID == null) {
                status = null;
            }
            
            if (status && status.activeSong)
            {
                sharkzapper.helpers.decodeHTMLEntitiesInStatus(status);
            }
        
            // On song change (or noDelta, or no cache) send urls
            var urls = (status && 
					    status.activeSong && 
						status.activeSong != null && 
						status.activeSong.SongID && 
						(noDelta || 
							(!sharkzapper.cache.playbackStatus || 
								(sharkzapper.cache.playbackStatus && 
								 sharkzapper.cache.playbackStatus.activeSong && 
								 sharkzapper.cache.playbackStatus.activeSong.SongID && 
								 status.activeSong.SongID != sharkzapper.cache.playbackStatus.activeSong.SongID)
							)
						)
            ) ? sharkzapper.helpers.getURLsForSong(status.activeSong) : null;
            
            // Delta status by default (e.g. playstats event)
            status = (noDelta) ? status : sharkzapper.helpers.delta(status, 'playbackStatus');
            if (urls && _.count(urls)) {
                status.activeSong.urls = urls;
            }
            sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": status, "cached": Boolean(cached), "delta": !Boolean(noDelta)});
        },
        propchange: function handle_propchange(status, noDelta, cached) {
            status = (noDelta) ? status : sharkzapper.helpers.delta(status, 'playbackProperties');
            sharkzapper.message.send({"command": "statusUpdate", "playbackProperties": status, "cached": Boolean(cached), "delta": !Boolean(noDelta)});
        },
        queuechange: function handle_queuechange(change) {
            if (debug) console.log('queuechange',change.type, change);
            if (change.type == 'propertyChange' || change.type == 'queueReset') {
                // simplify change because we don't care about most of the things and we don't want to waste time sending useless data
                // then send it
                if (sharkzapper.helpers.simplifyQueue(change.details)) {
                    sharkzapper.message.send({"command": "statusUpdate", "queue": change.details, "cached": false, "delta": true});
                } else {
                    if (debug) console.log('withheld queueChange, no change after simplification');
                }
            } else if (change.type == 'contentChange') {
                // Manually update cache
                if (!sharkzapper.cache.playbackStatus) {
                    sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                    sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                }
                if (sharkzapper.cache.playbackStatus.activeSong) {
                    sharkzapper.cache.playbackStatus.activeSong.index = change.fullQueue.activeSong.index;
                }
            
                // Prepare and send update
                var message = {"command": "statusUpdate", "playbackStatus": {"activeSong": {"index": change.fullQueue.activeSong.index}}, "cached": false, "delta": true};
                if (change.details.kind != 'move') {
                    message.queue = {"songs": change.fullQueue.songs.length};
                }
                sharkzapper.message.send(message);
            } 
        },
        votesong: function handle_votesong(queuePos, vote) {
            var songId = GS.player.getSongDetails(GS.player.queue.queueID, [queuePos])[0].SongID;
            if (songId == GS.player.activeSong.SongID) {
                if (debug) console.log('currentSongVoteChanged', vote);

                // Manually update cache
                if (!sharkzapper.cache.playbackStatus) {
                    sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                    sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                }
                if (sharkzapper.cache.playbackStatus.activeSong) {
                    sharkzapper.cache.playbackStatus.activeSong.autoplayVote = vote;
                }

                // Prepare and send update
                sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"autoplayVote": vote}}, "cached": false, "delta": true});
            }
            if (debug) console.log('votesong', songId, vote);  
        },
        sharkzapperPage: function handle_sharkzapperPage(pageType) {
            this.pageType = pageType || 'settings';
            console.log('sharkzapper page:', this.pageType);
            this.user = GS.user;
            switch(this.pageType) {
                case 'settings':
                    //this.settings = fetchsettings
                    if ($.View.preCached["gs_views_sharkzapper_settingsindex_ejs"] && $.View.preCached["gs_views_sharkzapper_settings_ejs"]) {
                        this.element.html(this.view("settingsindex"));
                        this.element.find("#page_pane").html(this.view("settings"));
                    } else if($.View.preCached["gs_views_sharkzapper_settingsindex_ejs"]) {
                        this.element.html(this.view("settingsindex"));
                        sharkzapper.message.send({"command":"fetchView","viewName":"sharkzapper_settings"});
                        sharkzapper.listeners.subscriptions["sharkzapper.viewupdate.sharkzapper_settings"] = $.subscribe("sharkzapper.viewupdate.sharkzapper_settings", function(a) {
                            return function() {
                                a.element.find("#page_pane").html(a.view("settings"));
                                setTimeout(function() {
                                    $.unsubscribe(sharkzapper.listeners.subscriptions["sharkzapper.viewupdate.sharkzapper_settings"]);
                                },0);
                            }
                        }(this));
                    } else {
                        sharkzapper.listeners.subscriptions["sharkzapper.settingsindexready"] = $.subscribe("sharkzapper.settingsindexready", function(a) {
                            return function() {
                                a.element.html(this.view("settingsindex"));
                                sharkzapper.message.send({"command":"fetchView","viewName":"sharkzapper_settings"});
                                sharkzapper.listeners.subscriptions["sharkzapper.viewupdate.sharkzapper_settings"] = $.subscribe("sharkzapper.viewupdate.sharkzapper_settings", function() {
                                    a.element.find("#page_pane").html(a.view("settings"));
                                    setTimeout(function() {
                                        $.unsubscribe(sharkzapper.listeners.subscriptions["sharkzapper.viewupdate.sharkzapper_settings"]);
                                    },0);
                                });                                
                                setTimeout(function() {
                                    $.unsubscribe(sharkzapper.listeners.subscriptions["sharkzapper.settingsindexready"]);
                                },0);
                            }
                        }(this));
                    }
                    break;
                default:
                    this.element.html("notFound");
                    //GS.router.notFound();
            }
        },
        songsAddedToLibrary: function handle_songsAddedToLibrary(songs) {
            if (debug) console.log(songs.songs.length, 'songsAddedToLibrary', songs.songs);
            var songId = sharkzapper.helpers.getCurrentSongID();
            if (!songId) return;
            for (i in songs.songs) {
                // Current playing song added
                if (songs.songs[i].songID == songId) {
                    // Manually update cache and send update (these objects are hell! + delta requires full object so not used)
                    if (!sharkzapper.cache.playbackStatus) {
                        sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                        sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                    }
                    sharkzapper.cache.playbackStatus.activeSong.fromLibrary = 1; 
                    sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"fromLibrary": 1}}, "cached": false, "delta": true});
                }
            }
        },
        songRemovedFromLibrary: function handle_songRemovedFromLibrary(songs) {
            if (debug) console.log('songRemovedFromLibrary', songs);
            var songId = sharkzapper.helpers.getCurrentSongID();
            if (!songId) return;
            // Current playing song removed
            if (songs.SongID == songId) {
                // Manually update cache and send update (these objects are hell! + delta requires full object so not used)
                if (!sharkzapper.cache.playbackStatus) {
                    sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                    sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                }
                sharkzapper.cache.playbackStatus.activeSong.fromLibrary = 0; 
                sharkzapper.cache.playbackStatus.activeSong.isFavorite = 0; 
                sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"fromLibrary": 0, "isFavorite": 0}}, "cached": false, "delta": true});
            }
        },
        songAddedToFavorites: function handle_songAddedToFavorites(songs) {
            if (debug) console.log('songAddedToFavorites', songs);
            var songId = sharkzapper.helpers.getCurrentSongID();
            if (!songId) return;
            // Current playing song added
            if (songs.SongID == songId) {
                // Manually update cache and send update (these objects are hell! + delta requires full object so not used)
                if (!sharkzapper.cache.playbackStatus) {
                    sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                    sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                }
                sharkzapper.cache.playbackStatus.activeSong.fromLibrary = 1;
                sharkzapper.cache.playbackStatus.activeSong.isFavorite = 1; 
                sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"fromLibrary": 1, "isFavorite": 1}}, "cached": false, "delta": true});
            }
        },
        songRemovedFromFavorites: function handle_songRemovedFromFavorites(songs) {
            if (debug) console.log('songRemovedFromFavorites', songs);
            var songId = sharkzapper.helpers.getCurrentSongID();
            if (!songId) return;
            // Current playing song removed
            if (songs.SongID == songId) {
                if (!sharkzapper.cache.playbackStatus) {
                    sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                    sharkzapper.helpers.decodeHTMLEntitiesInStatus(sharkzapper.cache.playbackStatus);
                }
                sharkzapper.cache.playbackStatus.activeSong.isFavorite = 0; 
                sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"isFavorite": 0}}, "cached": false, "delta": true});
            }            
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
                case 'setDebugLevel':
                    debug = data.level;
                    break;
            
                // Command called by contentscript to clean up and prepare for re-injection
                case 'cleanUp':
                    sharkzapper.destroy();
                    break;
                    
                // Command called by popup to get a forced status update, usually cached but may be fresh if cache unavailable
                case 'updateStatus':
                    if (sharkzapper.cache.playbackStatus && sharkzapper.cache.playbackProperties) {
                        var playbackStatus = $.extend({},sharkzapper.cache.playbackStatus);
                        if (playbackStatus.activeSong && playbackStatus.activeSong != null) {
                            playbackStatus.activeSong.urls = sharkzapper.helpers.getURLsForSong(playbackStatus.activeSong);
                        }
                        sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": playbackStatus, "playbackProperties": sharkzapper.cache.playbackProperties, "cached":true, "delta":false});
                    } else {
                        if (sharkzapper.cache.playbackStatus) {
                            var playbackStatus = $.extend({},sharkzapper.cache.playbackStatus);
                            if (playbackStatus.activeSong && playbackStatus.activeSong != null) {
                                playbackStatus.activeSong.urls = sharkzapper.helpers.getURLsForSong(playbackStatus.activeSong);
                            }
                            sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": playbackStatus, "cached":true, "delta":false});
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
                    //TODO: cache data like the rest of them 
                    sharkzapper.helpers.execWhenReady(function updateQueue() {
                        var queue = $.extend({}, GS.player.getCurrentQueue());
                        if (sharkzapper.helpers.simplifyQueue(queue)) {
                            sharkzapper.message.send({"command": "statusUpdate", "queue": queue, "cached": false, "delta": false});
                        }
                    },'updateQueue','onPlayerReady');  
                    sharkzapper.helpers.execWhenReady(function updateLibraryStatus() {
                        if (!sharkzapper.cache.playbackStatus) {
                            sharkzapper.cache.playbackStatus = GS.player.getPlaybackStatus();
                        }
                        var songId = sharkzapper.helpers.getCurrentSongID();
                        if (!songId) return;
                        var fromLibrary = GS.user.library.songs.hasOwnProperty(songId);
                        var isFavorite = GS.user.favorites.songs.hasOwnProperty(songId);
                        sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": {"activeSong": {"fromLibrary": fromLibrary, "isFavorite": isFavorite}}, "cached": false, "delta": true});
                    },'updateLibraryStatus','onPlayerReady');
                    //TODO: update isFavorite and fromLibrary!   <!-- (test this by reloading when buffered and paused, then opening popup)           
                    break;
                case 'viewUpdate': 
                    $.View.preCached["gs_views_"+data.viewName+"_ejs"] = data.view;
                    $.publish("sharkzapper.viewupdate."+data.viewName);
                    break;
                case 'settingsUpdate':
                    sharkzapper.settings = data.settings;
                    $.publish("sharkzapper.settingsupdate");
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
                case "playSong":
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.play();
                    break;
                case "pauseSong":
                    if (!sharkzapper.gs_ready) return;
                
                    Grooveshark.pause();
                    break;
                case "prevSong":
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.previous()
                    break;
                case "nextSong":
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.next()
                    break;
                        
                case "voteSong":    
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.voteCurrentSong(data.vote);
                    break;
                case "volumeUpdate":
                    if (!sharkzapper.gs_ready) return;
                    
                    Grooveshark.setVolume(data.volume);
                    break;
                case "setShuffle": 
                    if (!sharkzapper.gs_ready) return;
                    
                    GS.player.setShuffle(data.shuffle);
                    
                    // Fix for broken GS UI
                    $("#player_shuffle").toggleClass("active",data.shuffle)
                    break;
                case "setRepeat":
                    if (!sharkzapper.gs_ready) return;
                    
                    GS.player.setRepeat(data.repeatMode);                    
                    break;
                case "setCrossfadeEnabled":
                    if (!sharkzapper.gs_ready) return;
                    
                    GS.player.setCrossfadeEnabled(data.enabled);
                    break;
                case "addToLibrary":
                    if (!sharkzapper.gs_ready) return;
                    var songId = data.songId || sharkzapper.helpers.getCurrentSongID();
                    if (!songId) return;
                    GS.user.addToLibrary(songId);
                    break;
                case "removeFromLibrary":
                    if (!sharkzapper.gs_ready) return;
                    var songId = data.songId || sharkzapper.helpers.getCurrentSongID();
                    if (!songId) return;
                    GS.user.removeFromLibrary(songId);
                    break;
                case "addToSongFavorites":
                    if (!sharkzapper.gs_ready) return;
                    var songId = data.songId || sharkzapper.helpers.getCurrentSongID();
                    if (!songId) return;
                    GS.user.addToSongFavorites(songId);
                    break;
                case "removeFromSongFavorites":
                    if (!sharkzapper.gs_ready) return;
                    var songId = data.songId || sharkzapper.helpers.getCurrentSongID();
                    if (!songId) return;
                    GS.user.removeFromSongFavorites(songId);
                    break;
                case "performSearch":
                    if (!sharkzapper.gs_ready || !data.query) return;
                    var searchType = data.type || "";
                    GS.router.performSearch(searchType, data.query);
                    break;
            }
        }
    };
    sharkzapper.helpers = {
        delta: function delta(new_data, key) {
            var j = 0;
            if (!sharkzapper.cache[key]) {
                sharkzapper.cache[key] = new_data;
                return new_data;
            } else {
                var old_data = sharkzapper.cache[key];
                var delta_data = (typeof new_data == 'object' && new_data != null) ? (function calc_delta(new_data, old_data) {
                    j++;
                    if (j > 99) {
                        console.error('recusion limit reached. killing.');
                        return null;
                    }
                    if (old_data == null || old_data == undefined) {
                        return new_data;
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
        },
        simplifyQueue: function simplifyQueue(queue) {
            delete queue.queueID;
            if (queue.hasOwnProperty('activeSong') && queue.activeSong != null) {
                queue.activeSong = true;
            } 
            if (queue.hasOwnProperty('nextSong') && queue.nextSong != null) {
                queue.nextSong = true;
            }
            if (queue.hasOwnProperty('previousSong') && queue.previousSong != null) {
                queue.previousSong = true;
            }   
            if (queue.hasOwnProperty('songs') && queue.songs instanceof Array) {
                queue.songs = queue.songs.length;
            }
            return _.count(queue);
        },
        getCurrentSongID: function getCurrentSongID() {
            if (sharkzapper.cache.playbackStatus && sharkzapper.cache.playbackStatus.activeSong) {
                return sharkzapper.cache.playbackStatus.activeSong.SongID;
            } else if (sharkzapper.gs_player_ready) {
                var curSong = GS.player.getCurrentSong();
                if (!curSong || !curSong.SongID) return false;
                return curSong.SongID;
            } else {
                return false;
            }
        },
        getURLsForSong: function getURLsForSong(song) {
            if (!(song instanceof GS.Models.Song)) {
                song = new GS.Models.Song(song);
            }
            // URLs are relative to grooveshark.com
            return {
                songURL: song.toUrl(), //requires GS.Models.Song
                albumURL: _.cleanUrl(song.AlbumName, song.AlbumID, "album"),
                artistURL: _.cleanUrl(song.ArtistName, song.ArtistID, "artist")
            };
        },
        decodeHTMLEntitiesInStatus: function(playbackStatus) {
            if (playbackStatus.activeSong) {
                if (playbackStatus.activeSong.SongName)
                    playbackStatus.activeSong.SongName = playbackStatus.activeSong.SongName.replace(/&amp\;/g,"&").replace(/&quot\;/g,"\"");
                if (playbackStatus.activeSong.ArtistName)
                    playbackStatus.activeSong.ArtistName = playbackStatus.activeSong.ArtistName.replace(/&amp\;/g,"&").replace(/&quot\;/g,"\"");
                if (playbackStatus.activeSong.AlbumName)
                    playbackStatus.activeSong.AlbumName = playbackStatus.activeSong.AlbumName.replace(/&amp\;/g,"&").replace(/&quot\;/g,"\"");
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
        this.openSettings = function openSettings() {
            var pane = document.querySelector('#page_pane');
            var offset = (pane) ? (function getOffset( el ) {
                var _x = 0;
                var _y = 0;
                while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
                    _x += el.offsetLeft - el.scrollLeft;
                    _y += el.offsetTop - el.scrollTop;
                    el = el.offsetParent;
                }
                return { top: _y, left: _x };
            })(pane) : {top: 400, left: 80};
            var width = (pane) ? pane.offsetWidth : 600;
            var height = (pane) ? (pane.offsetHeight - 40) : 400;
            var left = window.screenLeft + offset.left;
            var top = window.screenTop + offset.top + 40;
            sharkzapper.message.send({command:"openPopup", url: "sharkzapper_options.html", features: "width="+width+",height="+height+",left="+left+",top="+top});
        };
    })();
    return this.init();
})(false);
