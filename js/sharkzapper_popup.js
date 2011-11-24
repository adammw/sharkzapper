/*
 * sharkzapper_popup.js
 * This is the popup script for sharkZapper which handles the UI functions of the popup
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
var sharkzapper = new (function SharkZapperPopup(debug){
    var sharkzapper = this;
    sharkzapper.urls = {
        albumartdefault: 'http://images.grooveshark.com/static/albums/90_album.png',
        albumartroot: 'http://beta.grooveshark.com/static/amazonart/'
    }
    sharkzapper.cache = {};
    sharkzapper.settings = {};
    sharkzapper.listeners = {
        bind: function bind_listners() {
            // DOM Events
            $(document).ready(sharkzapper.listeners.ready);
            
            // Chrome Events
            chrome.extension.onRequest.addListener(sharkzapper.listeners.request);
        },
        unbind: function unbind_listeners() {
            // DOM Events
            //TODO
            
            // Chrome Events
            chrome.extension.onRequest.removeListener(sharkzapper.listeners.request);
        },
        error: function handle_error(e) {
            console.error('sharkzapper error:',e);
        },
        ready: function handle_ready(e) {
            sharkzapper.ui.popup.init();
        },
        request: function handle_request(request, sender, sendResponse) {
            //TODO: filter out requests from non-primary tabs
            sharkzapper.message.recieve(request);
        }
    };
    sharkzapper.message = {
		connectPort: function connect_port() {
			sharkzapper.message.port = chrome.extension.connect({name: "popup"});
			sharkzapper.message.port.onMessage.addListener(sharkzapper.message.recieve);
			sharkzapper.message.port.onDisconnect.addListener(function() {
				console.error('port disconnected!!!');
				sharkzapper.message.port = null;
			});
		},
        send: function message_send(data) {
            data.source = "popup";
            data.notification = $('body').hasClass('notification');
            if (debug) data.timestamp = (new Date()).valueOf();
            if (debug) console.log("sharkzapper:", ">>>", data.command, data);
			if (sharkzapper.message.port) {
				sharkzapper.message.port.postMessage(data);
			} else {
				chrome.extension.sendRequest(data);
			}
        }, 
        recieve: function message_recieve(data) {
            if (debug) console.log("sharkzapper:", "<<<", data.command, data);
            switch (data.command) {
                case 'statusUpdate': 
                    // Update UI
                    sharkzapper.ui.popup.update(data);
                    
                    // Update cache
                    try {
                        if (data.hasOwnProperty('playbackStatus')) {
                            sharkzapper.helpers.undelta(data.playbackStatus, 'playbackStatus');
                        }
                        if (data.hasOwnProperty('playbackProperties')) {
                            sharkzapper.helpers.undelta(data.playbackProperties, 'playbackProperties');
                        }
                    } catch(e) {
                        console.error('undelta err:',e);
                    }
                    break;
                case 'settingsUpdate':
                    var oldSettings = $.extend({},sharkzapper.settings);
                
                    // Save new settings
                    sharkzapper.settings = $.extend({}, sharkzapper.settings, data.settings);
                    
                    // Update UI
                    sharkzapper.ui.popup.settingsUpdate(oldSettings, sharkzapper.settings);
                    break;
                    
                case 'setDebugLevel':
                    debug = data.level;
                    break;
            }
        }
    };
    sharkzapper.ui = {
        timeouts: {
            scrollables: [],
            volumeSlider: null
        },
        listeners: { 
            bind: function bind_ui_listeners() {
                $("#volumeSlider").bind('slide slidechange', sharkzapper.ui.listeners.volumeUpdate);
                $('#grooveshark').bind('click', sharkzapper.ui.listeners.groovesharkLogoClick);
                $('#player_volume').bind('click', sharkzapper.ui.listeners.volumeClick);
                $('#player_play_pause').bind('click', sharkzapper.ui.listeners.playPauseClick);
                $('#player_previous').bind('click', sharkzapper.ui.listeners.previousClick);
	            $('#player_next').bind('click', sharkzapper.ui.listeners.nextClick);
	            $('#player_shuffle').bind('click', sharkzapper.ui.listeners.shuffleClick);
	            $('#player_loop').bind('click', sharkzapper.ui.listeners.loopClick);
	            $('#player_crossfade').bind('click', sharkzapper.ui.listeners.crossfadeClick);
	            $('#addToLibraryBtn').bind('click', sharkzapper.ui.listeners.addToLibraryClick);
	            $('#addToFavoritesBtn').bind('click', sharkzapper.ui.listeners.addToFavoritesClick);
	            $('#radioSmileBtn').bind('click', sharkzapper.ui.listeners.radioSmileClick);
	            $('#radioFrownBtn').bind('click', sharkzapper.ui.listeners.radioFrownClick);
	            $('#settingsBtn').bind('click',sharkzapper.ui.listeners.settingsClick);
	            $('#pin').bind('click',sharkzapper.ui.listeners.pinClick);
	            $('#songName, #artistName, #albumName').bind('click',sharkzapper.ui.listeners.songInfoClick);
	            $('#search_form').bind('submit', sharkzapper.ui.listeners.searchSubmit);
	            $('#player_volume').bind('mouseenter', sharkzapper.ui.listeners.volumeBtnMouseEnter);
	            $('#player_volume').bind('mouseleave', sharkzapper.ui.listeners.volumeBtnMouseLeave);
	            $('#volumeControl').bind('mouseenter', sharkzapper.ui.listeners.volumeControlMouseEnter);
	            $('#volumeControl').bind('mouseleave', sharkzapper.ui.listeners.volumeControlMouseLeave);
	            $('#volumeSlider').bind('slidestart', sharkzapper.ui.listeners.volumeSliderSlideStart);
	            $('#volumeSlider').bind('slidestop', sharkzapper.ui.listeners.volumeSliderSlideStop);
            },
            unbind: function unbind_ui_listeners() {
                $("#volumeSlider").unbind('slide slidechange', sharkzapper.ui.listeners.volumeUpdate);
                $('#grooveshark').unbind('click', sharkzapper.ui.listeners.groovesharkLogoClick);
                $('#player_volume').unbind('click', sharkzapper.ui.listeners.volumeClick);
                $('#player_play_pause').unbind('click', sharkzapper.ui.listeners.playPauseClick);
                $('#player_previous').unbind('click', sharkzapper.ui.listeners.previousClick);
	            $('#player_next').unbind('click', sharkzapper.ui.listeners.nextClick);
	            $('#player_shuffle').unbind('click', sharkzapper.ui.listeners.shuffleClick);
	            $('#player_loop').unbind('click', sharkzapper.ui.listeners.loopClick);
	            $('#player_crossfade').unbind('click', sharkzapper.ui.listeners.crossfadeClick);
	            $('#addToLibraryBtn').unbind('click', sharkzapper.ui.listeners.addToLibraryClick);
                $('#addToFavoritesBtn').unbind('click', sharkzapper.ui.listeners.addToFavoritesClick);
	            $('#radioSmileBtn').unbind('click', sharkzapper.ui.listeners.radioSmileClick);
                $('#radioFrownBtn').unbind('click', sharkzapper.ui.listeners.radioFrownClick);
	            $('#settingsBtn').unbind('click',sharkzapper.ui.listeners.settingsClick);
                $('#pin').unbind('click',sharkzapper.ui.listeners.pinClick);
	            $('#songName, #artistName, #albumName').unbind('click',sharkzapper.ui.listeners.songInfoClick);
	            $('#search_form').unbind('submit', sharkzapper.ui.listeners.searchSubmit);
	            $('#player_volume').unbind('mouseenter', sharkzapper.ui.listeners.volumeBtnMouseEnter);
	            $('#player_volume').unbind('mouseleave', sharkzapper.ui.listeners.volumeBtnMouseLeave);
	            $('#volumeControl').unbind('mouseenter', sharkzapper.ui.listeners.volumeControlMouseEnter);
	            $('#volumeControl').unbind('mouseleave', sharkzapper.ui.listeners.volumeControlMouseLeave);
	            $('#volumeSlider').bind('slidestart', sharkzapper.ui.listeners.volumeSliderSlideStart);
	            $('#volumeSlider').bind('slidestop', sharkzapper.ui.listeners.volumeSliderSlideStop);
            },
            searchSubmit: function handle_searchSubmit(e) {
                e.preventDefault();
                if (!$('#searchBox').val().length) return;
                sharkzapper.message.send({"command": "openGSTab", "url": "#/search?q=" + escape($('#searchBox').val())});
            },
            addToFavoritesClick: function handle_addToFavoritesClick(e) {
                if ($('#addToFavoritesBtn').hasClass('selected')) {
			        sharkzapper.message.send({"command": "removeFromSongFavorites"});
		        } else {
			        sharkzapper.message.send({"command": "addToSongFavorites"});
		        }
            },
            addToLibraryClick: function handle_addToLibraryClick(e) {
                if ($('#addToLibraryBtn').hasClass('selected')) {
			        sharkzapper.message.send({"command": "removeFromLibrary"});
		        } else {
			        sharkzapper.message.send({"command": "addToLibrary"});
		        }
            },
            radioSmileClick: function handle_radioSmileClick(e) {
                sharkzapper.message.send({"command": "voteSong", "vote": ($('#radioSmileBtn').hasClass('selected')) ? 0 : 1});
            },
            radioFrownClick: function handle_radioFrownClick(e) {
                sharkzapper.message.send({"command": "voteSong", "vote": ($('#radioFrownBtn').hasClass('selected')) ? 0 : -1});
            },
            loopClick: function handle_loopClick(e) {
                if ($('#player_loop').hasClass("active") && $('#player_loop').hasClass("one")) {
                    sharkzapper.message.send({"command": "setRepeat", "repeatMode": 0}); //REPEAT_NONE
                } else if ($('#player_loop').hasClass("active")) {
                    sharkzapper.message.send({"command": "setRepeat", "repeatMode": 2}); //REPEAT_ONE
                } else {
                    sharkzapper.message.send({"command": "setRepeat", "repeatMode": 1}); //REPEAT_ALL
                }
            },
            crossfadeClick: function handle_crossfadeClick(e) {
                sharkzapper.message.send({"command": "setCrossfadeEnabled", "enabled": !$('#player_crossfade').hasClass('active')});
            },
            groovesharkLogoClick: function handle_groovesharkLogoClick(e) {
                sharkzapper.message.send({"command":"openGSTab"});
            },
            settingsClick: function handle_settingsClick(e) {
                sharkzapper.message.send({"command":"openPopup", "url":"sharkzapper_options.html"});
            },
            pinClick: function handle_pinClick(e) {
				if ($("#pin").hasClass("selected")) {
					sharkzapper.message.send({"command": "unpinPopup"});
				} else {
					sharkzapper.message.send({"command": "pinPopup"});
				}
            },
            playPauseClick: function handle_playPauseClick(e) {
                if (sharkzapper.cache.playbackStatus && sharkzapper.cache.playbackStatus.status == 7) { //PLAY_STATUS_COMPLETED
                    sharkzapper.message.send({"command": "playSong"});
                } else {
                    sharkzapper.message.send({"command": "togglePlayPause"});
                }
                //TODO check what to do for PLAY_STATUS_COMPLETE
                /*
                // if paused
			        sendMessage({"command": "resumeSong"});
		        // else if not playing
			        sendMessage({"command": "playSong"});
		        // else (hence is playing)
			        sendMessage({"command": "pauseSong"});
		        */
            },
            previousClick: function handle_previousClick(e) {
                sharkzapper.message.send({"command": "prevSong"});
            },
            nextClick: function handle_nextClick(e) {
                sharkzapper.message.send({"command": "nextSong"});
            },
            shuffleClick: function handle_shuffleClick(e) {
                sharkzapper.message.send({"command": "setShuffle", "shuffle": !$('#player_shuffle').hasClass('active')});
            },
            songInfoClick: function handle_songInfoClick(e) {
                sharkzapper.message.send({"command":"openGSTab", "url": $(e.target).attr('href')});
            },
            volumeClick: function handle_volumeClick(e) {
                sharkzapper.message.send({"command":"toggleMute"});
            },
            volumeBtnMouseEnter: function handle_volumeBtnMouseEnter(e) {
                if (debug) console.log('showVolumeControlOnHover',sharkzapper.settings.showVolumeControlOnHover);
                if (sharkzapper.settings.hasOwnProperty('showVolumeControlOnHover') && !sharkzapper.settings.showVolumeControlOnHover) return;
                if (sharkzapper.ui.timeouts.volumeSlider) clearTimeout(sharkzapper.ui.timeouts.volumeSlider);
                $("#volumeControl").fadeIn(200).focus();
                $('#queuePosition').animate({width:'hide'});
                $('#volumeControl').data('closeOnSlideStop', false);
            },
            volumeBtnMouseLeave: function handle_volumeBtnMouseLeave(e) {
                if (sharkzapper.ui.timeouts.volumeSlider) clearTimeout(sharkzapper.ui.timeouts.volumeSlider);
                sharkzapper.ui.timeouts.volumeSlider = setTimeout(sharkzapper.ui.listeners.volumeSliderTimeout,1200);
            },
            volumeControlMouseEnter: function handle_volumeControlMouseEnter(e) {
                if (sharkzapper.ui.timeouts.volumeSlider) clearTimeout(sharkzapper.ui.timeouts.volumeSlider);
            },
            volumeControlMouseLeave: function handle_volumeControlMouseLeave(e) {
                if (sharkzapper.ui.timeouts.volumeSlider) clearTimeout(sharkzapper.ui.timeouts.volumeSlider);
                sharkzapper.ui.timeouts.volumeSlider = setTimeout(sharkzapper.ui.listeners.volumeSliderTimeout,600);
            },
            volumeSliderSlideStart: function handle_volumeSliderSlideStart(e) {
                $(this).data('sliding',true);
            }, 
            volumeSliderSlideStop: function handle_volumeSliderSlideStop(e) {
                $(this).data('sliding',false);
                if ($(this).data('slideendvalue')) {
                    $('#volumeSlider').slider("option", "value", $(this).data('slideendvalue'));
                }
                if ($('#volumeControl').data('closeOnSlideStop')) {
                    $("#volumeControl").fadeOut(200).blur();
                    $('#queuePosition').animate({width:'show'});
                }
            },
            volumeSliderTimeout: function handle_volumeSliderTimeout() {
                if (debug) console.log('volumeSlider timeout, was sliding: ',$('#volumeSlider').data('sliding'));
                if (!$('#volumeSlider').data('sliding')) {
                    $("#volumeControl").fadeOut(200).blur();
                    $('#queuePosition').animate({width:'show'});
                } else {
                    $('#volumeControl').data('closeOnSlideStop', true);
                }
            },
            volumeUpdate: function handle_volumeUpdate(e,b) {
                var steps = ["off", "one", "two", "three", "four", "five"];
                var muted = $('#player_volume').hasClass('muted');
                if (typeof b.value == "number") { 
                    var stepClass = steps[Math.ceil(b.value / 20)] || "";
                    $("#player_volume").attr("class", "player_control main_asset " + stepClass);
                }
                $('#player_volume').toggleClass('muted', muted);

                // Filter out programattic changes
                if (!e.originalEvent) return;
                
                sharkzapper.message.send({"command":"volumeUpdate","volume": b.value});
                if (debug) console.log('vol:',e,b);
            }
        },
        popup: {
            ready: false,
            init: function ui_popup_init() {
                // Check for notification indication
                $('body').toggleClass('notification', location.hash == '#notification');
                
                try {
                    // Initalise jQuery UI components
                    $("#volumeSlider").slider({
                        orientation: "vertical",
                        range: "min",
                        min: 0,
                        max: 100, 
                        value: 100
                    });
                    
                    // Bind listeners
                    sharkzapper.ui.listeners.bind();
                    
                    // Set Ready
                    sharkzapper.ui.popup.ready = true;
                } catch(e) {
                    console.error('ui_popup_init: fatal error',e);
                    return;
                }
                
                // Perform all queued updates
                if (debug) console.log('ui ready, performing',sharkzapper.ui.popup.updateQueue.length,'queued status updates');
                while (sharkzapper.ui.popup.updateQueue.length) {
                    sharkzapper.ui.popup.update(sharkzapper.ui.popup.updateQueue.shift());
                }
            },
            update: function update(status) {
                if (!sharkzapper.ui.popup.ready) {
                    if (debug) console.log('got update but not ready, adding to queue', status, sharkzapper.ui.popup.updateQueue.length);
                    sharkzapper.ui.popup.updateQueue.push(status);
                    return;
                }
                // Check for null playbackStatus - indicates nothing to play / nothing playing
                if (status.hasOwnProperty('playbackStatus') && !status.playbackStatus) {
                    if (debug) console.log('got null playbackStatus, hiding detail');
                    $('#songDetails, #albumart, #lowerControls, #player_controls_right, #queue_position').addClass('hidden');
                    $('#player_play_pause').addClass('disabled').removeClass('pause');
                    $('#player_play_pause, #player_controls_right button').attr('disabled','disabled').addClass('disabled');
                    $('#player_duration, #player_elapsed').text('');
                    $('body').addClass('notPlaying');
                    //TODO
                }
                
                // Update if playing
                if (status.playbackStatus) {
                    if (status.playbackStatus.activeSong) {
                        $('#player_play_pause, #player_controls_right button').removeAttr('disabled').removeClass('disabled');
                        if (debug) console.timeEnd('firstStatus');
                        if (status.playbackStatus.activeSong.hasOwnProperty('SongName')) {
                            $('#songName').text(status.playbackStatus.activeSong.SongName);
                        } 
                        if (status.playbackStatus.activeSong.hasOwnProperty('AlbumName')) {
    					    $('#albumName').text(status.playbackStatus.activeSong.AlbumName);
					    }
					    if (status.playbackStatus.activeSong.hasOwnProperty('ArtistName')) {
    					    $('#artistName').text(status.playbackStatus.activeSong.ArtistName);
					    }
					    if (status.playbackStatus.activeSong.hasOwnProperty('SongName') || status.playbackStatus.activeSong.hasOwnProperty('AlbumName') || status.playbackStatus.activeSong.hasOwnProperty('ArtistName')) { 
					        sharkzapper.ui.popup.updateScrollables()
					    }
					    
					    if (status.playbackStatus.activeSong.hasOwnProperty('CoverArtFilename')) {
                            $('#albumart').attr('src', (status.playbackStatus.activeSong.CoverArtFilename) ? sharkzapper.urls.albumartroot + 's' + status.playbackStatus.activeSong.CoverArtFilename : sharkzapper.urls.albumartdefault);
                        }
                        
                        if (status.playbackStatus.activeSong.hasOwnProperty('index')) {
                            $('#queue_current_position').text(status.playbackStatus.activeSong.index+1);
                            if (!sharkzapper.settings.hasOwnProperty('showQueuePosition') || sharkzapper.settings.showQueuePosition) {
                                $('#queue_position').removeClass('hidden');
                            }
                        }
                        
                        if (status.playbackStatus.activeSong.hasOwnProperty('fromLibrary')) {
                            $('#addToLibraryBtn').toggleClass('selected',Boolean(status.playbackStatus.activeSong.fromLibrary));
                            if ($('#addToLibraryBtn').hasClass('selected')) {
                                $('#addToLibraryBtn').attr('title', 'Remove from My Music');
                            } else {
                                $('#addToLibraryBtn').attr('title', 'Add to My Music');
                            }
                        }
                        if (status.playbackStatus.activeSong.hasOwnProperty('isFavorite')) {
                            $('#addToFavoritesBtn').toggleClass('selected',Boolean(status.playbackStatus.activeSong.isFavorite));
                            if ($('#addToFavoritesBtn').hasClass('selected')) {
                                $('#addToFavoritesBtn').attr('title', 'Remove from Favorites');
                            } else {
                                $('#addToFavoritesBtn').attr('title', 'Add to Favorites');
                            }
                        }
						
						if (status.playbackStatus.activeSong.hasOwnProperty('autoplayVote')) {
							$('#radioSmileBtn').toggleClass('selected', status.playbackStatus.activeSong.autoplayVote == 1);
							$('#radioFrownBtn').toggleClass('selected', status.playbackStatus.activeSong.autoplayVote == -1);
						}
                        
                        if (status.playbackStatus.activeSong.hasOwnProperty('urls')) {
                            if (status.playbackStatus.activeSong.urls.hasOwnProperty('songURL')) {
                                $('#songName').attr('href',status.playbackStatus.activeSong.urls.songURL);
                            }
                            if (status.playbackStatus.activeSong.urls.hasOwnProperty('albumURL')) {
                                $('#albumName').attr('href',status.playbackStatus.activeSong.urls.albumURL);
                            }
                            if (status.playbackStatus.activeSong.urls.hasOwnProperty('artistURL')) {
                                $('#artistName').attr('href',status.playbackStatus.activeSong.urls.artistURL);
                            }
                        }
                    }
                    if (status.playbackStatus.hasOwnProperty('duration')) {
                        $('#player_duration').text(sharkzapper.helpers.msec2time(status.playbackStatus.duration));
                    }
                    if (status.playbackStatus.hasOwnProperty('position')) {
                        $('#player_elapsed').text(sharkzapper.helpers.msec2time(status.playbackStatus.position));
                    }
                    if (status.playbackStatus.hasOwnProperty('status')) {
                        /* Valid statuses are:
                            PLAY_STATUS_NONE: 0,
                            PLAY_STATUS_INITIALIZING: 1,
                            PLAY_STATUS_LOADING: 2,
                            PLAY_STATUS_PLAYING: 3,
                            PLAY_STATUS_PAUSED: 4,
                            PLAY_STATUS_BUFFERING: 5,
                            PLAY_STATUS_FAILED: 6,
                            PLAY_STATUS_COMPLETED: 7, */
                    
                        // Hides thumbnail and most controls when PLAY_STATUS_FAILED
                        $('#songDetails, #lowerControls').toggleClass('hidden', status.playbackStatus.status == 6);
                        $('#player_controls_right').toggleClass('hidden', status.playbackStatus.status == 6 || (sharkzapper.settings.hasOwnProperty('showQueueButtons') && !sharkzapper.settings.showQueueButtons));
                        $('#albuma!newSettings.showAlbumArtrt').toggleClass('hidden', status.playbackStatus.status == 6 || (sharkzapper.settings.hasOwnProperty('showAlbumArt') && !sharkzapper.settings.showAlbumArt));
                        
                        // Changes body size when not playing
                        $('body').toggleClass('notPlaying', status.playbackStatus.status == 6); //PLAY_STATUS_FAILED
                        
                        // Show pause button when playing
                        $('#player_play_pause').toggleClass('pause', status.playbackStatus.status == 3); //PLAY_STATUS_PLAYING
                        
                        // Show buffering logo when PLAY_STATUS_INITIALIZING, PLAY_STATUS_LOADING or PLAY_STATUS_BUFFERING
                        $('#player_play_pause').toggleClass('buffering', (status.playbackStatus.status == 1 || status.playbackStatus.status == 2 || status.playbackStatus.status == 5)); 
                        $('#bufferinglogo').toggleClass('hidden', !(status.playbackStatus.status == 1 || status.playbackStatus.status == 2 || status.playbackStatus.status == 5)); 
                    }
                }
                if (status.playbackProperties) {
                    if (status.playbackProperties.hasOwnProperty('isMuted')) {
                        $('#player_volume').toggleClass('muted', status.playbackProperties.isMuted);
                    }
                    if (status.playbackProperties.hasOwnProperty('crossfadeEnabled')) {
                        $('#player_crossfade').toggleClass('active', status.playbackProperties.crossfadeEnabled);
                    }
                    if (status.playbackProperties.hasOwnProperty('volume')) {
                        if ($("#volumeSlider").data('sliding')) { //Don't update the volume when sliding or else jerkiness occurs
                            $('#volumeSlider').data("slideendvalue", status.playbackProperties.volume);
                        } else { 
                            $('#volumeSlider').slider("option", "value", status.playbackProperties.volume);
                        }
                    }
                }
                if (status.queue) {
                    if (status.queue.hasOwnProperty('shuffleEnabled')) {
                        $('#player_shuffle').toggleClass('active', status.queue.shuffleEnabled);
                    }
                    if (status.queue.hasOwnProperty('repeatMode')) {
                        $('#player_loop').toggleClass('active', Boolean(status.queue.repeatMode));
					    $('#player_loop').toggleClass('one', status.queue.repeatMode == 2); //REPEAT_ONE
                    }
                    if (status.queue.hasOwnProperty('autoplayEnabled')) {
                        $('#playerDetails_nowPlaying').toggleClass('radioOn', status.queue.autoplayEnabled);
                    }
                    if (status.queue.hasOwnProperty('previousSong')) {
                        if (status.queue.previousSong) {
                            if (debug) console.log('has prev song');
                            $('#player_previous').removeAttr('disabled');
                        } else {
                            if (debug) console.log('has no prev song');
                            $('#player_previous').attr('disabled','disabled');
                        }
                    }
                    if (status.queue.hasOwnProperty('nextSong')) {
                        if (status.queue.nextSong) {
                            $('#player_next').removeAttr('disabled');
                        } else {
                            $('#player_next').attr('disabled','disabled');
                        }
                    }
                    if (status.queue.hasOwnProperty('songs') && typeof status.queue.songs == 'number') {
                        $('#queue_total').text(status.queue.songs);
                        $('#queue_position_separator, #queue_total').toggleClass('hidden',!status.queue.songs);
                    }
                }
				
				// SharkZapper specifics
				if (status.hasOwnProperty('pinnedPopupOpen')) {
					$('#pin').toggleClass('selected', status.pinnedPopupOpen);
				}
			},
            settingsUpdate: function settingsUpdate(oldSettings, newSettings) {
                if (newSettings.hasOwnProperty('showPlaybackButtons')) {
                    $('#player_controls_playback').toggleClass('hidden', !newSettings.showPlaybackButtons);
                }
                if (newSettings.hasOwnProperty('showQueueButtons')) {
                    $('#player_controls_right').toggleClass('hidden', !newSettings.showQueueButtons);
                }
                if (newSettings.hasOwnProperty('showQueuePosition')) {
                    $('#queue_position').toggleClass('hidden', !newSettings.showQueuePosition);
                }
                if (newSettings.hasOwnProperty('showMuteButton')) {
                    $('#player_volume').toggleClass('hidden', !newSettings.showMuteButton);
                }
                if (newSettings.hasOwnProperty('showSearchBox')) {
                    $('#search').toggleClass('hidden', !newSettings.showSearchBox);
                }
                if (newSettings.hasOwnProperty('showAlbumArt')) {
                    $('#albumart').toggleClass('hidden', !newSettings.showAlbumArt);
                    $('body').toggleClass('noAlbumArt', !newSettings.showAlbumArt);
                }
                //TODO: Other options un-implemented
            },
            updateQueue: [],
            updateScrollables: function() {
                var scrollRate = 50;
                var scrollDelay = 3000;
                $(sharkzapper.ui.timeouts.scrollables).each(function(i,t) {
                    clearTimeout(t);
                });
                //TODO: Delay start of next scroll until all three have finished scrolling
                $('.scrollable').each(function(i, el) {
                    $(el).clearQueue().stop().css('marginLeft',0).children().not(':first-child').remove();
                    var width = $(el).children().width();
                    var clone = $(el).children().eq(0).clone();
					//TODO: Fix bug where on first change width is 0 and therefore doesn't scroll
                    if (($(el).width() + 10) >= width) return; //Ignore text that fits fine (with some leeway) 
					console.log('will scroll',el);
                    $(el).append('<span class="sep"> - </span>');
                    $(el).append(clone);
                    width += $(el).children().eq(1).width();
                    console.log('elwidth',$(el).width(),'width',width);
                    (function animate() {
                        $(el).animate({marginLeft: -width}, width*scrollRate, 'linear', function() {
                            $(this).delay(1).css('marginLeft', 0);
                            sharkzapper.ui.timeouts.scrollables.push(setTimeout(animate, scrollDelay));
                        });
                    })();
                });
            }
        }
    };
    sharkzapper.helpers = {
        undelta: function undelta(new_data, key) {
            if (!sharkzapper.cache[key]) {
                sharkzapper.cache[key] = new_data;
                return new_data;
            } else {
                var old_data = sharkzapper.cache[key];
                var undelta_data = (function calc_undelta(new_data, old_data) {
                    var undelta_data = {};
                    for (i in old_data) {
                        undelta_data[i] = old_data[i];
                    }
                    for (i in new_data) {
                        if (typeof new_data[i] == 'object') {
                            undelta_data[i] = calc_undelta(new_data[i], old_data[i]); 
                        } else {
                            undelta_data[i] = new_data[i];
                        }
                    }
                    return undelta_data
                })(new_data, old_data);
                sharkzapper.cache[key] = undelta_data;
                return undelta_data;
            }
        },
        msec2time: function msec2time(msec) {
            // return in m:ss
            return Math.floor(msec / 1000 / 60) + ":" + sharkzapper.helpers.lpad((Math.floor(msec / 1000) % 60).toString(), "0", 2);
        },
        lpad: function lpad(str, padString, length) {
            while (str.length < length)
                str = padString + str;
            return str;
        }
    };
    sharkzapper.toggleDebug = function toggleDebug() {
        debug = !debug;
    };
    sharkzapper.init = function init() {
        try {
            sharkzapper.listeners.bind();
        } catch (e) {
            sharkzapper.listeners.error(e);
        }
		sharkzapper.message.connectPort();
        //sharkzapper.message.send({"command":"popupInit"});
        //sharkzapper.message.send({"command":"fetchSettings"}); //TODO: Incorporate into popupInit request
        if (debug) console.time('firstStatus');
        
        return sharkzapper;
    };
    return this.init();
})(0); //debug level: 0=none, 1=most, 2=all
/*
var defaultAlbumArtUrl = 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png';	
var statusMap = ["PLAY_STATUS_NONE", "PLAY_STATUS_INITIALIZING", "PLAY_STATUS_LOADING", "PLAY_STATUS_PLAYING", "PLAY_STATUS_PAUSED", "PLAY_STATUS_BUFFERING", "PLAY_STATUS_FAILED", "PLAY_STATUS_COMPLETED"];
var repeatMap = ["REPEAT_NONE","REPEAT_ALL","REPEAT_ONE"];
var songId = null;
var tabId = null;
var debug = false;
var debugStatusUpdate = false;
var scrollTimeouts = [];
var volumeControlTimeout = null;
var lastVolume = null;

String.prototype.pad = function(l, s){
return (l -= this.length) > 0 
    ? (s = new Array(Math.ceil(l / s.length) + 1).join(s)).substr(0, s.length) + this + s.substr(0, l - s.length) 
    : this;
};

function getSetting(settingName,callback) {
	if (debug) console.log("sharkzapper:",">>>","getSetting",settingName);
	chrome.extension.sendRequest({"command":"getSetting","source":"popup","settingName":settingName},callback);
}

function sendMessage(request) {
	request.source = "popup";
	request.notification = $('body').hasClass('notification');
	if (debug) console.log("sharkzapper:",">>>",request.command,request);
	chrome.extension.sendRequest(request);
}

function loadVolumeEffects() {
    $("#player_volume").mouseenter(function(){
        $("#volumeControl").fadeIn(200);
    });
    $("#player_volume").mouseleave(function(){
        if(volumeControlTimeout) clearTimeout(volumeControlTimeout);
        volumeControlTimeout = setTimeout('$("#volumeControl").fadeOut(200);',1200);
    });
    $("#volumeControl").mouseenter(function(){
        if(volumeControlTimeout) clearTimeout(volumeControlTimeout);
    });
    $("#volumeControl").mouseleave(function(){
        if(volumeControlTimeout) clearTimeout(volumeControlTimeout);
        volumeControlTimeout = setTimeout('$("#volumeControl").fadeOut(200);',600);
    });
}

function volumeUpdate(e,b) {
    if (debug) console.log('volume update',e,b);
    if (e.originalEvent) sendMessage({"command":"volumeUpdate","volume":$('#volumeSlider').slider("option", "value")});
}

$(document).ready(function(){
    // Add class for notification
    if(location.hash == '#notification') {
        $('body').addClass('notification');
	}
	
	// Add Button click handlers
	$('#player_previous').click(function(){sendMessage({"command": "prevSong"})});
	$('#player_next').click(function(){sendMessage({"command": "nextSong"})});
	$('#player_shuffle').click(function(){sendMessage({"command": "setShuffle", "shuffle": !$('#player_shuffle').hasClass('active')})});
	$('#player_crossfade').click(function(){sendMessage({"command": "setCrossfadeEnabled", "enabled": !$('#player_crossfade').hasClass('active')})});
	$('#player_loop').click(function(){
	    if ($(this).hasClass("active") && $(this).hasClass("one")) {
            sendMessage({"command": "setRepeat", "repeatMode":"REPEAT_NONE"});
        } else if ($(this).hasClass("active")) {
            sendMessage({"command": "setRepeat", "repeatMode":"REPEAT_ONE"});
        } else {
            sendMessage({"command": "setRepeat", "repeatMode":"REPEAT_ALL"});
        }
	});
    $('#pin').click(function(){sendMessage({"command": "pinPopup"})});
    $('#settingsBtn').click(function(){sendMessage({"command":"openGSTab", "url":"#/settings/sharkzapper"})});
	$('#player_play_pause').click(function(){
		if($('#player_play_pause').hasClass('paused')) {
			sendMessage({"command": "resumeSong"});
		} else if (!$('#player_play_pause').hasClass('playing')) {
			sendMessage({"command": "playSong"});
		} else {
			sendMessage({"command": "pauseSong"});
		}
	});
	$('#grooveshark').click(function(){sendMessage({"command":"openGSTab"});});
	$('#player_volume').click(function(){sendMessage({"command": "toggleMute"});});
	$('#addToLibraryBtn').click(function(){
		if ($('#addToLibraryBtn').hasClass('selected')) {
			sendMessage({"command": "removeFromLibrary", "songId": songId});
		} else {
			sendMessage({"command": "addToLibrary", "songId": songId});
		}
	});
	$('#addToFavoritesBtn').click(function(){
		if ($('#addToFavoritesBtn').hasClass('selected')) {
			sendMessage({"command": "removeFromSongFavorites", "songId": songId});
		} else {
			sendMessage({"command": "addToSongFavorites", "songId": songId});
		}
	});
	$('#radioSmileBtn').click(function(){
		sendMessage({"command": "toggleSmile"});
	});
	$('#radioFrownBtn').click(function(){
		sendMessage({"command": "toggleFrown"});
	});
	$('#songDetails a').click(function(e){
		sendMessage({"command":"openGSTab", "url": $(this).attr('href')});
	    e.preventDefault();
	    return false;
	});
	
	// Add Search form handler
	$('#search_form').submit(function(){ 
		sendMessage({"command":"openGSTab", "url":"#/search?q=" + $('#searchBox').val()});
		sendMessage({"command":"performSearch", "query": $('#searchBox').val()});
	    	$('#searchBox').val(''); $('#searchBox').blur(); return false; 
	});
	
	// Hide/show elements based on settings
	getSetting("showSearchBox",function(showSearchBox) {
        $('#search').toggleClass('hidden',!showSearchBox);
    });
    getSetting("showQueueButtons",function(showQueueButtons) {
        $('#player_controls_right').toggleClass('hidden',!showQueueButtons);
    });
    getSetting("showPlaybackButtons",function(showPlaybackButtons) {
        $('#player_controls_playback').toggleClass('hidden',!showPlaybackButtons);
    });
    getSetting("showAlbumArt",function(showAlbumArt) {
        $('body').toggleClass('noAlbumArt',!showAlbumArt);
    });
    
    // Volume Control effects
    getSetting("showVolumeControlOnHover",function(showVolumeControlOnHover) {
        if(showVolumeControlOnHover) loadVolumeEffects();
    });
    
    // Set up volume slider
    $("#volumeSlider").slider({
        orientation: "horizontal",
        range: "min",
        min: 0,
        max: 100,
        slide: volumeUpdate,
        change: volumeUpdate
    });
});

chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
		if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:","<<<",request.command,request,sender);
		if (!request.command) return;
		if (tabId && sender.tab && sender.tab.id != tabId) return; //stop multiple tabs sending us updates
		switch (request.command) {
			case 'popupUpdate':
			    if($('body').hasClass('notification') && request.includeNotification != true) return;
			    if (request.closeImmediately) window.close();
				if (request.enabled) {
					$('button').removeAttr('disabled');
					$('button').removeClass('disabled');
					$('body').removeClass('notPlaying');
				} else {
					$('button').addClass('disabled');
					$('body').addClass('notPlaying');
					$('button').attr('disabled','disabled');
					$('#player_play_pause').removeClass('pause');
				}
				if (request.pinnedPopupOpen) {
				    $('#pin').addClass('hidden');
                    $('#settingsBtn').addClass('noPin');
                }
				if (request.tabId) tabId = request.tabId;
				break;
			case 'statusUpdate':
				if (request.currentSong) {
				    $('button').removeAttr('disabled');
					$('button').removeClass('disabled');
				
					$('#songName').text(request.currentSong.SongName);
					$('#albumName').text(request.currentSong.AlbumName);
					$('#artistName').text(request.currentSong.ArtistName);
					if (request.urls) {
					    $('#songName').attr('href', request.urls.song);
					    $('#albumName').attr('href', request.urls.album);
					    $('#artistName').attr('href', request.urls.artist);
					} else {
						$('#songName, #albumName, #artistName').removeAttr('href');
					}
					$('#albumart').attr('alt', request.currentSong.AlbumName);
					$('#player_elapsed').text(Math.floor(request.playbackStatus.position / 1000 / 60) + ":" + (Math.floor(request.playbackStatus.position / 1000) % 60).toFixed().pad(2, "0"));
					$('#player_duration').text(Math.floor(request.playbackStatus.duration / 1000 / 60) + ":" + (Math.floor(request.playbackStatus.duration / 1000) % 60).toFixed().pad(2, "0"));
					if (request.currentSong.CoverArtFilename) {
						$('#albumart').attr('src', request.currentSong.artPath + 'm' + request.currentSong.CoverArtFilename);
					} else {
						$('#albumart').attr('src', defaultAlbumArtUrl);
					}
					if (request.currentSong.fromLibrary) {
						$('#addToLibraryBtn').addClass('selected');
					} else {
						$('#addToLibraryBtn').removeClass('selected');
					}
					if (request.currentSong.isFavorite) {
						$('#addToFavoritesBtn').addClass('selected');
					} else {
						$('#addToFavoritesBtn').removeClass('selected');
					}
					
					$('#player_shuffle').toggleClass('active',Boolean(request.shuffle));
					$('#player_crossfade').toggleClass('active',Boolean(request.crossfade));
					$('#player_loop').toggleClass('active',Boolean(request.repeat));
					$('#player_loop').toggleClass('one',(repeatMap[request.repeat] == 'REPEAT_ONE'));
					
					$('#player_play_pause').removeAttr('disabled');
					$('#player_play_pause').removeClass('disabled');
					$('#albumart').removeClass('hidden');
					$('#songDetails').removeClass('hidden');
				    getSetting("showMuteButton",function(showMuteButton) {
                        $('#player_volume').toggleClass('hidden',!showMuteButton);
                    });
					$('#playerDetails_nowPlaying').removeClass('hidden');
					$('body').removeClass('notPlaying');
					
					songId = request.currentSong.SongID;
				} else { 
					songId = null;
					$('#songName').text('');
					$('#albumName').text('');
					$('#artistName').text('');
					$('#player_elapsed').text('');
					$('#player_duration').text('');
					$('#player_play_pause').attr('disabled','disabled');
					$('#player_play_pause').addClass('disabled');
					$('#albumart').addClass('hidden');
					$('#songDetails').addClass('hidden');
					$('#player_volume').addClass('hidden');
					$('#playerDetails_nowPlaying').addClass('hidden');
					$('body').addClass('notPlaying');
				}
				if (request.prevSong) {
					$('#player_previous').removeClass('disabled');						
					$('#player_previous').removeAttr('disabled');
				} else {
					$('#player_previous').addClass('disabled');	
					$('#player_previous').attr('disabled','disabled');
				}
				$('#player_play_pause').toggleClass('pause',!request.isPaused && request.isPlaying); //inverse logic
				$('#player_play_pause, body').toggleClass('paused',request.isPaused);
				$('#player_play_pause, body').toggleClass('playing',request.isPlaying);

                if (!(request.playbackStatus && request.playbackStatus.activeSong && request.playbackStatus.activeSong.queueSongID && request.queueLength)) {
                    $('#queue_position').addClass('hidden');
                } else {
                    getSetting("showQueuePosition",function(showQueuePosition) {
                        $('#queue_position').toggleClass('hidden',!showQueuePosition);
                    });
                }
			    if (request.playbackStatus) {
			        var status = statusMap[request.playbackStatus.status];
	                if (debug) console.log("status:",status);
                    if (status == 'PLAY_STATUS_LOADING' || status == 'PLAY_STATUS_BUFFERING') {
                        $('#player_play_pause').addClass('buffering').removeClass('pause');
                        $('#bufferinglogo').removeClass('hidden');
                    } else {
                        $('#player_play_pause').removeClass('buffering');
                        $('#bufferinglogo').addClass('hidden');
                    }
                    if (status == 'PLAY_STATUS_COMPLETED' && request.playbackStatus.activeSong && request.playbackStatus.activeSong.queueSongID  && request.queueLength && request.playbackStatus.activeSong.queueSongID == request.queueLength) {
                        $('body').addClass('notPlaying');
                    }
                    if (request.playbackStatus.activeSong && request.playbackStatus.activeSong.queueSongID  && request.queueLength) {
						$('#queue_current_position').text(request.playbackStatus.activeSong.index + 1);
						$('#queue_total').text(request.queueLength);
					} 
			    }
				if (request.nextSong) {
					$('#player_next').removeClass('disabled');						
					$('#player_next').removeAttr('disabled');
				} else {
					$('#player_next').addClass('disabled');
					$('#player_next').attr('disabled','disabled');
				}
				if (request.isMuted) {
					$('#player_volume').addClass('mute');
				} else {
					$('#player_volume').removeClass('mute');
				}
				$('#playerDetails_nowPlaying').toggleClass('radioOn',request.isRadio);
				if (request.isRadio) {
					$('#radioSmileBtn').toggleClass('selected',request.isSmile);
					$('#radioFrownBtn').toggleClass('selected',request.isFrown);	
				}
				if (request.volume != lastVolume) {
				    $("#volumeSlider").slider("option","value",request.volume);
				}
				lastVolume = request.volume;
				break;
			case 'settingsUpdate':
			    if (!request.settings) return;		        
		        $('#search').toggleClass('hidden',!request.settings.showSearchBox);
		        if(request.settings.showVolumeControlOnHover) {
			        loadVolumeEffects();
		        } else {
		            $('#volumeControl').hide();
		            $("#player_volume,#volumeControl").unbind('mouseenter').unbind('mouseleave');
		        }
		        $('#player_controls_right').toggleClass('hidden',!request.settings.showQueueButtons);
		        $('#player_controls_playback').toggleClass('hidden',!request.settings.showPlaybackButtons);
		        $('body').toggleClass('noAlbumArt',!request.settings.showAlbumArt);
		        break;
		}		
	}
);	

// Send a popupInit message when we have finished loading this script
sendMessage({"command": "popupInit"}); */
