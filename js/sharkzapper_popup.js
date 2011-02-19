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
		sendMessage({"command":"openGSTab", "url":"#/search/all?q=" + $('#searchBox').val()});
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
sendMessage({"command": "popupInit"}); 
