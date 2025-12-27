/*
 *script reference: https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting
 */

 var DJ202 = {};

  // Tweakables
 
 DJ202.stripSearchScaling = 0.15;
 DJ202.tempoRange = [0.08, 0.16, 0.5];
 DJ202.autoShowFourDecks = false; 
 

 // **********  Code Start ********
 DJ202.init = function() {
    
 
     DJ202.deck = [];
     for (let i = 0; i < 4; i++) {
         DJ202.deck[i] = new DJ202.Deck(i + 1, i);
         DJ202.deck[i].setCurrentDeck("[Channel" + (i + 1) + "]");
     }
 
     // LEDs SAMPLER PADs ---> without NO LEDs on PADs
    DJ202.initSamplerLeds();

    //Sequencer
    DJ202.sequencer = new DJ202.Sequencer();


    //LOAD BUTTON TO DECK 1,2,3,4
 
// Funzione per creare un pulsante LOAD per ogni deck
// Funzione per creare un pulsante LOAD con tap breve e lungo
DJ202.createLoadTrackButton = function(channelGroup, midiStatus, midiControl) {
    const button = new components.Button({
        group: channelGroup,
        midi: [midiStatus, midiControl],
        pressTime: 0,
        longPressThreshold: 300, // ms

        input: function(channel, control, value, status, _group) {
            const isPressed = this.isPress(channel, control, value, status);

            if (isPressed) {
                this.pressTime = Date.now();
            } else {
                const duration = Date.now() - this.pressTime;
                const longPress = duration > this.longPressThreshold;

                if (longPress) {
                    // TAP lungo → espelli traccia
                    engine.setValue(this.group, "eject", 1);
                } else {
                    // TAP breve → carica o cambia traccia
                    engine.setValue(this.group, "LoadSelectedTrack", 1);
                }

                // aggiorna LED dopo l'azione
                this.updateLed();
            }
        },

        updateLed: function() {
            const hasTrack = engine.getValue(this.group, "track_samples") > 0;
            this.send(hasTrack ? this.on : this.off);
        }
    });

    // Aggiorna LED quando cambia traccia
    engine.makeConnection(channelGroup, "track_samples", function() {
        button.updateLed();
    });

    // Spegne LED quando la traccia finisce o si ferma
    engine.makeConnection(channelGroup, "play", function(value) {
        if (value === 0) {
            button.send(button.off);
        }
    });

    return button;
};

// Crea i pulsanti LOAD per i deck sinistro e destro
DJ202.leftLoadTrackButton = DJ202.createLoadTrackButton("[Channel1]", 0x9F, 0x02);
DJ202.rightLoadTrackButton = DJ202.createLoadTrackButton("[Channel2]", 0x9F, 0x03);
DJ202.leftLoadTrackButton = DJ202.createLoadTrackButton("[Channel3]", 0x9F, 0x04);
DJ202.rightLoadTrackButton = DJ202.createLoadTrackButton("[Channel4]", 0x9F, 0x05);

// Pulsanti per passare da Deck1 a Deck3 e da Deck2 a Deck4
DJ202.deck3Button = new DJ202.DeckToggleButton({
    midi: [0x90, 0x08],
    decks: [1, 3],
    loadTrackButton: DJ202.leftLoadTrackButton,
});

DJ202.deck4Button = new DJ202.DeckToggleButton({
    midi: [0x91, 0x08],
    decks: [2, 4],
    loadTrackButton: DJ202.rightLoadTrackButton,
});


    // All'avvio: esegue l'eject su tutti i deck per LED spenti
    ["[Channel1]", "[Channel2]", "[Channel3]", "[Channel4]"].forEach(group => {
        engine.setValue(group, "eject", 1);
    });

     

    // *********** MAIN VOLUME/KNOB SECTION ************************
    //MASTER VOLUME
    DJ202.masterGain = new components.Pot({
        midi: [0xBF, 0x0E],  // Messaggio MIDI per il volume master
        group: "[Master]",
        inKey: "pregain",  // Associa il controllo al volume master
        input: function(value) {
            // Scala il valore MIDI (0-127) a un intervallo tra 0.0 e 1.0
            const mappedVolume = value / 127 * 10.0;
    
            // Imposta il volume master in Mixxx
            engine.setValue("[Master]", "gain", mappedVolume);  // Impostazione del volume master
    
            // Imposta anche il pregain, se necessario (se vuoi che entrambi si aggiornino)
            engine.setValue("[Master]", "pregain", mappedVolume);
    
            // Mantieni il comportamento di base del potenziometro
            this.max = 0x7F;  // Imposta il massimo a 0x7F (127)
            components.Pot.prototype.input.apply(this, arguments);  // Applica la logica di input predefinita
        }
    });
    
    //CUE/MASTER
    DJ202.cueMasterVolume = new components.Pot({
        midi: [0xBF, 0x0D],  // Messaggio MIDI per il controllo volume CUE/MASTER
        group: "[Master]",
        inKey: "headMix",  // Associa il controllo a headMix
        input: function(value) {
            // Mappa il valore MIDI (0-127) in un range tra 0.0 e 1.0 (gamma standard per Mixxx)
            const mappedVolume = value / 127 * 10.0; // Mappa 0-127 a 0.0 - 1.0 per headMix

            // Imposta il volume CUE/MASTER con il valore mappato
            engine.setValue("[Master]", "headMix", mappedVolume);

            // Mantieni il comportamento di base del potenziometro
            this.max = 0x7F;  // Imposta il massimo a 0x7F (127)
            components.Pot.prototype.input.apply(this, arguments);  // Applica la logica di input predefinita
        }
    });

    //HEADPHONE VOLUME
    DJ202.headVolume = new components.Pot({
    midi: [0xBF, 0x0C],  // Messaggio MIDI per il controllo volume cuffie
    group: "[Master]",
    inKey: "headGain",  // Modifica questo campo per associare il controllo al volume cuffie
    input: function(value) {
        // Mappa il valore MIDI (0-127) in un range tra 0.0 e 5.0
        const mappedVolume = (value / 127) * 10.0; // 127 MIDI value -> 0.0 - 5.0 per headGain

        // Imposta il volume cuffie con il valore mappato
        engine.setValue("[Master]", "headGain", mappedVolume);

        // Mantieni il comportamento di base del potenziometro
        this.max = 0x7F;  // Imposta il massimo a 0x7F (127)
        components.Pot.prototype.input.apply(this, arguments);  // Applica la logica di input predefinita
    }
});
   
     // *********** EFFECT SECTION ************************
     DJ202.effectUnit = [];
     for (let i = 0; i <= 1; i++) {
         DJ202.effectUnit[i] = new components.EffectUnit([i + 1, i + 3]);
         DJ202.effectUnit[i].sendShifted = true;
         DJ202.effectUnit[i].shiftOffset = 0x0B;
         DJ202.effectUnit[i].shiftControl = true;
         DJ202.effectUnit[i].enableButtons[1].midi = [0x98 + i, 0x00]; 
         DJ202.effectUnit[i].enableButtons[2].midi = [0x98 + i, 0x01]; 
         DJ202.effectUnit[i].enableButtons[3].midi = [0x98 + i, 0x02];       
         DJ202.effectUnit[i].effectFocusButton.midi = [0x98 + i, 0x04];
         DJ202.effectUnit[i].knobs[1].midi = [0xB8 + i, 0x00];
        
         for (let j = 1; j <= 4; j++) {
             DJ202.effectUnit[i].enableOnChannelButtons.addButton("Channel" + j);
             DJ202.effectUnit[i].enableOnChannelButtons["Channel" + j].midi = [0x98 + i, 0x04 + j];
         }   
         
         DJ202.effectUnit[i].init();
     }

    // Change effect setted
    DJ202.shiftFxSelect = function(effectIndex) {
        return function(channel, control, value, status, group) {
            if (value !== 0x7F) return;
    
            let effectUnit = "";
            let effectSlot = "";
    
            switch (group) {
                case "[Channel1]":
                    effectUnit = "EffectUnit1";
                    effectSlot = `Effect${effectIndex}`;
                    break;
                case "[Channel2]":
                    effectUnit = "EffectUnit1";
                    effectSlot = `Effect${effectIndex + 1}`;
                    break;
                case "[Channel3]":
                    effectUnit = "EffectUnit2";
                    effectSlot = `Effect${effectIndex}`;
                    break;
                case "[Channel4]":
                    effectUnit = "EffectUnit2";
                    effectSlot = `Effect${effectIndex + 1}`;
                    break;
                default:
                    return;
            }
    
            const effectGroup = `[EffectRack1_${effectUnit}_${effectSlot}]`;
            engine.setValue(effectGroup, "next_effect", 1);
        };
    };
    
    // Assegna le funzioni ai rispettivi FX SELECT
    DJ202.shiftFx1 = DJ202.shiftFxSelect(1);
    DJ202.shiftFx2 = DJ202.shiftFxSelect(2);
    DJ202.shiftFx3 = DJ202.shiftFxSelect(3); 
    
 
    DJ202.autoShowDecks = function(_value, _group, _control) {
    const anyLoaded = engine.getValue("[Channel3]", "track_loaded") || engine.getValue("[Channel4]", "track_loaded");
    if (!DJ202.autoShowFourDecks) {
        return;
    }
    engine.setValue("[Master]", "show_4decks", anyLoaded);
 };

    // Dopo la definizione, fai la connessione
    engine.makeConnection("[Channel3]", "track_loaded", DJ202.autoShowDecks);
    engine.makeConnection("[Channel4]", "track_loaded", DJ202.autoShowDecks);

    // Collegamento per il reset dei pad LED su track load
    DJ202.trackLoadedConnections = [
        engine.makeConnection("[Channel1]", "track_loaded", DJ202.onTrackLoaded),
        engine.makeConnection("[Channel2]", "track_loaded", DJ202.onTrackLoaded)
    ];

     // Send Serato SysEx messages to request initial state and unlock pads
     midi.sendSysexMsg([0xF0, 0x00, 0x20, 0x7F, 0x00, 0xF7], 6);
     midi.sendSysexMsg([0xF0, 0x00, 0x20, 0x7F, 0x01, 0xF7], 6);
 
     // Send "keep-alive" message to keep controller in Serato mode (usato per tenere i led degli effetti accesi)
     engine.beginTimer(500, () => {
         midi.sendShortMsg(0xBF, 0x64, 0x00);
     });
 
     // Reset LEDs
     //linked to TRACK LOAD
     DJ202.deck3Button.trigger();
     DJ202.deck4Button.trigger();
     for (let i = 0; i < 4; i++) {
         DJ202.deck[i].reconnectComponents();
     }
 };
 
 DJ202.shutdown = function() {
 };
 
 // ********************* BROWSING LIBRARY *************************
 DJ202.browseEncoder = new components.Encoder({
     isListExpanded: false, // Stato per controllare se la lista è espansa
     isLongPressed: false,  // Stato per rilevare un long press
     clickTimer: 0,         // Timer per distinguere short e long click
     clickTimeout: 500,     // Durata in ms per distinguere short e long click
     isClickInProgress: false, // Stato per indicare che un click è in corso
 
     resetState: function() {
         // Reimposta lo stato del knob dopo un click
         this.isLongPressed = false;
         this.isClickInProgress = false;
     },
 
     unshift: function() {
         this.onKnobEvent = function(rotateValue) {
             if (rotateValue !== 0) {
                 if (!this.isClickInProgress) {
                     if (!this.isListExpanded) {
                         // Naviga tra le playlist o contenitori
                         engine.setValue("[Playlist]", "SelectPlaylist", rotateValue);
                     } else {
                         // Naviga tra i brani
                         engine.setValue("[Playlist]", "SelectTrackKnob", rotateValue);
                     }
                 }
             }
         };
 
         this.onButtonEvent = function(value) {
             if (value) {
                 // Inizio del click
                 this.isLongPressed = false;
                 this.isClickInProgress = true;
 
                 // Avvia un timer per rilevare il long click
                 this.clickTimer = engine.beginTimer(
                     this.clickTimeout,
                     () => {
                         this.isLongPressed = true;
                         // Long click: cambia sezione (libreria <-> brani)
                         script.triggerControl("[Playlist]", "ToggleSelectedSidebarItem");
                         this.resetState();
                     },
                     true
                 );
             } else {
                 // Fine del click
                 if (this.clickTimer !== 0) {
                     engine.stopTimer(this.clickTimer);
                     this.clickTimer = 0;
                 }
 
                 if (!this.isLongPressed) {
                     // Short click: espandi o contrai la lista
                     if (!this.isListExpanded) {
                         script.triggerControl("[Playlist]", "ToggleSelectedSidebarItem");
                         this.isListExpanded = true;
                     } else {
                         script.triggerControl("[Playlist]", "LoadSelectedSidebarItem");
                         this.isListExpanded = false;
                     }
                 }
 
                 // Reimposta lo stato
                 this.resetState();
             }
         };
     },
 
     shift: function() {
         this.onKnobEvent = function(rotateValue) {
             if (rotateValue !== 0) {
                 // Cambia colore delle tracce in modalità shift
                 const key = (rotateValue > 0) ? "track_color_next" : "track_color_prev";
                 engine.setValue("[Library]", key, 1.0);
             }
         };
 
         this.onButtonEvent = function(value) {
             if (value) {
                 this.trackColorCycleEnabled = true;
             } else {
                 this.trackColorCycleEnabled = false;
             }
         };
     },
 
     input: function(channel, control, value, status, group) {
         switch (status) {
             case 0xBF: { // Rotazione del knob
                 const rotateValue = (value === 127) ? -1 : ((value === 1) ? 1 : 0);
                 this.onKnobEvent(rotateValue);
                 break;
             }
             case 0x9F: // Pressione del knob
                 this.onButtonEvent(value)
                 script.triggerControl(group, this.isShifted ? 'MoveFocusBackward'
                    : 'MoveFocusForward');
                 break;
         }
     },
 });
 
     DJ202.sortLibrary = function(channel, control, value, _status, _group) {
     if (value === 0) {
     return;
     }
      
     let sortColumn;
     switch (control) {
     case 0x12: // SONG
     sortColumn = 2;
     break;
     
     case 0x13: // BPM
     sortColumn = 15;
     break;
     default:
     
     // unknown sort column
     return;
     }
     
     engine.setValue("[Library]", "sort_column_toggle", sortColumn);
     
     };
  
 // ============================= CROSSFADER =================================
 DJ202.crossfader = new components.Pot({
     midi: [0xBF, 0x08],
     group: "[Master]",
     inKey: "crossfader",
     input: function() {
         // We need a weird max. for the crossfader to make it cut cleanly.
         // However, components.js resets max. to 0x3fff when the first value is
         // received. Hence, we need to set max. here instead of within the
         // constructor.
         this.max = (0x7f<<7) + 0x70;
         components.Pot.prototype.input.apply(this, arguments);
     }
 });
 DJ202.crossfader.setCurve = function(channel, control, value, _status, _group) {
     // 0x00 is Picnic Bench, 0x01 is Constant Power and 0x02 is Linear
     switch (value) {
     case 0x00:  // Picnic Bench / Fast Cut
         engine.setValue("[Mixer Profile]", "xFaderMode", 0);
         engine.setValue("[Mixer Profile]", "xFaderCalibration", 0.9);
         engine.setValue("[Mixer Profile]", "xFaderCurve", 7.0);
         break;
     case 0x01:  // Constant Power
         engine.setValue("[Mixer Profile]", "xFaderMode", 1);
         engine.setValue("[Mixer Profile]", "xFaderCalibration", 0.3);
         engine.setValue("[Mixer Profile]", "xFaderCurve", 0.6);
         break;
     case 0x02: // Additive
         engine.setValue("[Mixer Profile]", "xFaderMode", 0);
         engine.setValue("[Mixer Profile]", "xFaderCalibration", 0.4);
         engine.setValue("[Mixer Profile]", "xFaderCurve", 0.9);
     }
 };
 
 DJ202.crossfader.setReverse = function(channel, control, value, _status, _group) {
     // 0x00 is ON, 0x01 is OFF
     engine.setValue("[Mixer Profile]", "xFaderReverse", (value === 0x00) ? 1 : 0);
 };

 // ************************* INPUT/OUTPUT SECTION ********************************************
 DJ202.setChannelInput = function(channel, control, value, _status, _group) {
    const number = (channel === 0x00) ? 0 : 1;
    const channelgroup = "[Channel" + (number + 1) + "]";
    switch (value) {
    case 0x00:  // PC
        engine.setValue(channelgroup, "passthrough", 0);
        break;
    case 0x01:  // LINE
    case 0x02:  // PHONO
        engine.setValue(channelgroup, "passthrough", 1);
        break;
    }
};

 
 // ***************** INIZIO FUNZIONI: Sync, Tempo, Jog, Mixer, ecc... *****************
 DJ202.Deck = function(deckNumbers, offset) {
     components.Deck.call(this, deckNumbers);
     
     // ============================= JOG WHEELS =================================
     this.wheelTouch = function(channel, control, value, _status, _group) {
         if (value === 0x7F && !this.isShifted) {
             const alpha = 1.0/8;
             const beta = alpha/32;
             engine.scratchEnable(script.deckFromGroup(this.currentDeck), 512, 45, alpha, beta);
         } else {    // If button up
             engine.scratchDisable(script.deckFromGroup(this.currentDeck));
         }
     };
 
     this.wheelTurn = function(channel, control, value, _status, _group) {
         // When the jog wheel is turned in clockwise direction, value is
         // greater than 64 (= 0x40). If it's turned in counter-clockwise
         // direction, the value is smaller than 64.
         const newValue = value - 64;
         const deck = script.deckFromGroup(this.currentDeck);
         if (engine.isScratching(deck)) {
             engine.scratchTick(deck, newValue); // Scratch!
         } else if (this.isShifted) {
             const oldPos = engine.getValue(this.currentDeck, "playposition");
             // Since ‘playposition’ is normalized to unity, we need to scale by
             // song duration in order for the jog wheel to cover the same amount
             // of time given a constant turning angle.
             const duration = engine.getValue(this.currentDeck, "duration");
             const newPos = Math.max(0, oldPos + (newValue * DJ202.stripSearchScaling / duration));
             engine.setValue(this.currentDeck, "playposition", newPos); // Strip search
         } else {
             engine.setValue(this.currentDeck, "jog", newValue); // Pitch bend
         }
     };      
 
     // ========================== FADER SLIDE ==============================
     engine.setValue(this.currentDeck, "rate_dir", -1);
     this.tempoFader = new components.Pot({
         group: "[Channel" + deckNumbers + "]",
         midi: [0xB0 + offset, 0x09],
         connect: function() {
             engine.softTakeover(this.group, "pitch", true);
             engine.softTakeover(this.group, "rate", true);
             components.Pot.prototype.connect.apply(this, arguments);
         },
         unshift: function() {
             this.inKey = "rate";
             this.inSetParameter = components.Pot.prototype.inSetParameter;
             engine.softTakeoverIgnoreNextValue(this.group, "pitch");
         },
         shift: function() {
             this.inKey = "pitch";
             this.inSetParameter = function(value) {
                 // Scale to interval ]-7…7[; invert direction as per controller
                 // labeling.
                 value = 14 * value - 7;
                 value *= -1;
                 components.Pot.prototype.inSetValue.call(this, value);
             };
             engine.softTakeoverIgnoreNextValue(this.group, "rate");
         }
     });
 
     // ========================== KEY LOCK ==============================                  
     this.keylock = new components.Button({
         midi: [0x90 + offset, 0x0D],
         sendShifted: true,
         shiftControl: true,
         shiftOffset: 1,
         outKey: "keylock",
         currentRangeIndex: (DJ202.tempoRange.indexOf(engine.getValue("[Channel" + deckNumbers + "]", "rateRange"))) ? DJ202.tempoRange.indexOf(engine.getValue("[Channel" + deckNumbers + "]", "rateRange")) : 0,
         unshift: function() {
             this.inKey = "keylock";
             this.input = components.Button.prototype.input;
             this.type = components.Button.prototype.types.toggle;
         },
         shift: function() {
             this.inKey = "rateRange";
             this.type = undefined;
             this.input = function(channel, control, value, status, _group) {
                 if (this.isPress(channel, control, value, status)) {
                     this.currentRangeIndex++;
                     if (this.currentRangeIndex >= DJ202.tempoRange.length) {
                         this.currentRangeIndex = 0;
                     }
                     this.inSetValue(DJ202.tempoRange[this.currentRangeIndex]);
                 }
             };
         },
     });
 
     // ============================= SLIP BUTTON =======================
     this.slipModeButton = new DJ202.SlipModeButton({
         midi: [0x90 + offset, 0x07],
     });

    // ======================= SHIFT BUTTON ========================
    DJ202.shiftButton = function(channel, control, value, _status, _group) {
        DJ202.deck.forEach(
            value ? module => module.shift() : module => module.unshift()
        );
    };

    // === COMPONENTE INTERNA (gestione stato SHIFT) ===
    this.shiftButtonComponent = new components.Button({
        midi: [0x9F + offset, 0x00],
        input: function(channel, control, value, status, group) {
            DJ202.isShiftActive = (value === 0x7F);
            console.log(`SHIFT ${DJ202.isShiftActive ? "attivato" : "disattivato"}`);
        }
    });

     // ============================= SYNC BUTTON ==========================
     this.sync = new components.Button({
        midi: [0x90 + offset, 0x02],
        group: "[Channel" + deckNumbers + "]",
        outKey: "sync_mode",
        output: function(value, group, control) {
            if (this.connections[1] !== undefined) {
                this.connections[1].disconnect();
                delete this.connections[1];
            }

            // If the new sync_mode is "Explicit Leader", use the blinking
            // indicator for the LED instead.
            if (value === 2) {
                if (this.connections[1] === undefined) {
                    this.connections[1] = engine.makeConnection("[App]", "indicator_500ms", this.setLed.bind(this));
                }
                return;
            }

            this.setLed(value, group, control);
        },
        setLed: function(value, _group, _control) {
            midi.sendShortMsg(this.midi[0], value ? 0x02 : 0x03, this.on);
        },
        input: function(channel, control, value, _status, _group) {
            if (control === 0x02) { // Ensure the input is from the SYNC button
                const currentTime = new Date().getTime();
        
                if (value === 0x7F) { // Button pressed
                    if (this.lastPressTime && (currentTime - this.lastPressTime) < this.doubleTapTimeout) {
                        // Detected double tap
                        if (this.longPressTimer) {
                            engine.stopTimer(this.longPressTimer);
                            this.longPressTimer = 0;
                        }
                        this.onDoubleTap();
                        this.lastPressTime = 0; // Reset last press time
                    } else {
                        // Start a timer to distinguish between short and long press
                        if (!this.longPressTimer) {
                            this.longPressTimer = engine.beginTimer(this.longPressTimeout, () => {
                                this.onLongPress();
                                this.longPressTimer = 0;
                                this.lastPressTime = 0; // Reset last press time to avoid double tap conflicts
                            }, true);
                        }
        
                        // Provide immediate feedback by lighting up the LED
                        this.setLed(1, this.group, null);
                    }
                    this.lastPressTime = currentTime;
                } else if (value === 0x00) { // Button released
                    if (this.longPressTimer !== 0) {
                        // Short press: Stop the timer and trigger short press action
                        engine.stopTimer(this.longPressTimer);
                        this.longPressTimer = 0;
                        this.onShortPress();
                    }
        
                    // Turn off the LED upon release
                    this.setLed(0, this.group, null);
                }
            }
        },
        
        unshift: function() {
            this.onShortPress = function() {
                script.triggerControl(this.group, "beatsync", 1);
            };

            this.onDoubleTap = function() {
                engine.setValue(this.group, "quantize", !engine.getValue(this.group, "quantize"));
            };

            this.onLongPress = function() {
                if (engine.getValue(this.group, "sync_enabled")) {
                    // If already explicit leader, reset explicit state
                    // (setting it to 0 may still make it implicit leader and
                    // immediately resetting it to 1).
                    const value = (engine.getValue(this.group, "sync_leader") === 2) ? 0 : 2;
                    engine.setValue(this.group, "sync_leader", value);
                } else {
                    engine.setValue(this.group, "sync_enabled", 1);
                }
            };
        },

        doubleTapTimeout: 300, // Timeout for detecting double tap (in ms)
        longPressTimeout: 500 // Timeout for detecting long press (in ms)

    });
 
     // ========================== CUE, Play Button ==============================
     this.cue = new components.CueButton({
         midi: [0x90 + offset, 0x01],
         sendShifted: true,
         shiftControl: true,
         shiftOffset: 4,
         reverseRollOnShift: true,
         input: function(channel, control, value, status, group) {
             components.CueButton.prototype.input.call(this, channel, control, value, status, group);
             if (value) {
                 return;
             }
             const state = engine.getValue(group, "cue_indicator");
             if (state) {
                 this.trigger();
             }
         }
     });
 
     this.play = new components.PlayButton({
        midi: [0x90 + offset, 0x00],
        sendShifted: true,
        shiftControl: true,
        shiftOffset: 4,
      
        unshift: function () {
          this.inKey = 'play';
      
          this.input = function (channel, control, value, status, group) {
            const deck = script.deckFromGroup(group);
            const isPlaying = engine.getValue(group, 'play');
      
            if (value) {
              // Button press
              this.longPressed = false;
              this.longPressStart = new Date();
              this.longPressTimer = engine.beginTimer(300, () => {
                this.longPressed = true;
              }, true);
            } else {
              // Button release
              if (this.longPressTimer) {
                engine.stopTimer(this.longPressTimer);
                this.longPressTimer = null;
              }
      
              const pressDuration = new Date() - this.longPressStart;
      
              if (this.longPressed) {
                if (isPlaying && !this.isBraking) {
                  engine.brake(deck, true, 1000 / pressDuration);
                  this.isBraking = true;
                } else {
                  engine.softStart(deck, true, 1000 / pressDuration);
                  this.isBraking = false;
                }
              } else {
                this.isBraking = false;
                script.toggleControl(group, 'play', !isPlaying);
              }
      
              this.longPressed = false;
            }
          };
        },
      });

    // *********  REVERSE & STUTTER (CUE and PLAY/PAUSE)
        // SHIFT + CUE (control = 0x05) → Reverse
    this.reverse = new components.Button({
        midi: [0x90 + offset, 0x05],
        type: components.Button.prototype.types.toggle,
        key: 'reverse',
    });
    
    // SHIFT + PLAY (control = 0x04) → Stutter
    this.stutter = new components.Button({
        midi: [0x90 + offset, 0x04],
        input: function(channel, control, value, status, group) {
        if (value) {
            // Simula STUTTER: ritorna alla posizione cue e riparte
            const cuePoint = engine.getValue(group, 'cue_point');
            engine.setValue(group, 'play', 0);
            engine.setValue(group, 'playposition', cuePoint);
            engine.setValue(group, 'play', 1);
        } else {
            engine.setValue(group, 'play', 0);
        }
        }
    });
      
     // =============================== MIXER ZONE ====================================
     this.pregain = new components.Pot({
         midi: [0xB0 + offset, 0x16],
         group: "[Channel" + deckNumbers + "]",
         inKey: "pregain",
     });
 
     this.eqKnob = [];
     for (let k = 1; k <= 3; k++) {
         this.eqKnob[k] = new components.Pot({
             midi: [0xB0 + offset, 0x20 - k],
             group: "[EqualizerRack1_" + this.currentDeck + "_Effect1]",
             inKey: "parameter" + k,
         });
     }
 
     this.filter = new components.Pot({
         midi: [0xB0 + offset, 0x1A],
         group: "[QuickEffectRack1_" + this.currentDeck + "]",
         inKey: "super1",
     });
     //Pre-ascolto 'CUE'
     this.pfl = new components.Button({
         midi: [0x90 + offset, 0x1B],
         group: "[Channel" + deckNumbers + "]",
         type: components.Button.prototype.types.toggle,
         inKey: "pfl",
         outKey: "pfl",
     });
 
     this.tapBPM = new components.Button({
         midi: [0x90 + offset, 0x12],
         group: "[Channel" + deckNumbers + "]",
         input: function(_channel, _control, value, _status, group) {
             if (value) {
                 this.longPressTimer = engine.beginTimer(this.longPressTimeout, () => {
                     this.onLongPress(group);
                     this.longPressTimer = 0;
                 }, true);
             } else if (this.longPressTimer !== 0) {
                 // Button released after short press
                 engine.stopTimer(this.longPressTimer);
                 this.longPressTimer = 0;202
                 this.onShortPress(group);
             }
         },
         onShortPress: function(group) {
             script.triggerControl(group, "beats_translate_curpos");
         },
         onLongPress: function(group) {
             script.triggerControl(group, "beats_translate_match_alignment");
         },
     });
 
     this.volume = new components.Pot({
         midi: [0xB0 + offset, 0x1C],
         group: "[Channel" + deckNumbers + "]",
         inKey: "volume",
     });
 
 };
 
 function setHeadphoneVolume(volume) {
    // Implementa la logica per impostare il volume delle cuffie nel tuo sistema
    console.log(`Volume cuffie impostato a: ${volume * 100}%`);
}
  
 DJ202.Deck.prototype = Object.create(components.Deck.prototype);
 
 
 DJ202.DeckToggleButton = function(options) {
     this.secondaryDeck = false;
     components.Button.call(this, options);
 };
 DJ202.DeckToggleButton.prototype = Object.create(components.Button.prototype);
 DJ202.DeckToggleButton.prototype.input = function(channel, control, value, status, _group) {
     if (this.isPress(channel, control, value, status)) {
         // Button was pressed
         this.longPressTimer = engine.beginTimer(
             this.longPressTimeout,
             () => { this.isLongPressed = true; },
             true
         );
         this.secondaryDeck = !this.secondaryDeck;
     } else if (this.isLongPressed) {
         // Button was released after long press
         this.isLongPressed = false;
         this.secondaryDeck = !this.secondaryDeck;
     } else {
         // Button was released after short press
         engine.stopTimer(this.longPressTimer);
         this.longPressTimer = null;
         return;
     }
 
     this.trigger();
 };
 
 DJ202.DeckToggleButton.prototype.trigger = function() {
     this.send(this.secondaryDeck ? this.on : this.off);
     const newGroup = "[Channel" + (this.secondaryDeck ? this.decks[1] : this.decks[0]) + "]";
     if (this.loadTrackButton.group !== newGroup) {
         this.loadTrackButton.group = newGroup;
         this.loadTrackButton.disconnect();
         this.loadTrackButton.connect();
         this.loadTrackButton.trigger();
     }
 };
 
    // =============================  SLIP FUNCTION & VINYL CONTROL ==================================
    DJ202.SlipModeButton = function(options) {
        components.Button.call(this, options);
    };
    DJ202.SlipModeButton.prototype = Object.create(components.Button.prototype);

    // Comportamento senza Shift (Slip Mode)
    DJ202.SlipModeButton.prototype.unshift = function() {
        this.inKey = "slip_enabled";
        this.outKey = "slip_enabled";
        this.type = components.Button.prototype.types.toggle;

        // Comportamento semplice: attiva/disattiva Slip Mode con un singolo tap
        this.input = function(channel, control, value, _status, _group) {
            if (value) { // Solo sul "press", non sul "release"
                const slipEnabled = engine.getValue(this.group, "slip_enabled");
                engine.setValue(this.group, "slip_enabled", !slipEnabled); // Toggle Slip Mode
                console.log(`Slip Mode ${!slipEnabled ? "attivato" : "disattivato"}`);
            }
        };

        this.disconnect();
        this.connect();
        this.trigger();
    };

    // Comportamento con Shift (Vinyl Control)
    DJ202.SlipModeButton.prototype.shift = function() {
        this.inKey = "vinylcontrol_enabled";
        this.outKey = "vinylcontrol_enabled";
        this.type = components.Button.prototype.types.toggle;

        // Comportamento semplice: attiva/disattiva Vinyl Control
        this.input = function(channel, control, value, _status, _group) {
            if (value) { // Solo sul "press", non sul "release"
                const vinylEnabled = engine.getValue(this.group, "vinylcontrol_enabled");
                engine.setValue(this.group, "vinylcontrol_enabled", !vinylEnabled); // Toggle Vinyl Control
                console.log(`Vinyl Control ${!vinylEnabled ? "attivato" : "disattivato"}`);
            }
        };

        this.disconnect();
        this.connect();
        this.trigger();
    };
 
// ======================= GESTIONE PARAM BUTTON ========================
DJ202.paramButtonPressed = function(channel, control, value, status, group) {
    if (!this.currentMode) return;

    const isParamMinus = (control === 0x43);
    if (isParamMinus) {
        DJ202.isParamMinusPressed[group] = (value === 0x7F);
    }

    let button;

    switch (control) {
        case 0x4B: // PARAMETER 2 minus
            if (this.currentMode.param2MinusButton) {
                button = this.currentMode.param2MinusButton;
                break;
            }
            break;
        case 0x43: // PARAMETER 1 minus
            button = this.currentMode.paramMinusButton;
            break;
        case 0x4C: // PARAMETER 2 plus
            if (this.currentMode.param2PlusButton) {
                button = this.currentMode.param2PlusButton;
                break;
            }
            break;
        case 0x44: // PARAMETER 1 plus
            button = this.currentMode.paramPlusButton;
            break;
    }

    if (button) {
        button.input(channel, control, value, status, group);
    }
};

//************************ Button: Hotcue Loop, Sequencer, Sampler **************************
DJ202.onTrackLoaded = function(value, group) {
    if (value) {
        // Una nuova traccia è stata caricata: aggiorna tutti i LED pad
        DJ202.updateAllHotcueLeds(group);
        DJ202.updateAllLoopLeds(group);
        // DJ202.updateAllRollLeds(group);
    }
};

 //**************************** LED ON PADS  ***********************************/ 
DJ202.PadsColor = {
    OFF: 0x00,
    YELLOW: 0x04,
    RED: 0x01,
};

DJ202.getStatusByteForGroup = function(group) {
    switch (group) {
        case "[Channel1]":
            return 0x94;
        case "[Channel2]":
            return 0x95;
        case "[Channel3]":
            return 0x96;
        case "[Channel4]":
            return 0x97;
        default:
            return 0x94; // Fallback su Channel1
    }
};

DJ202.setPadLed = function(control, color, group) {
    const status = DJ202.getStatusByteForGroup(group);
    midi.sendShortMsg(status, control, color);
};

 //**************************** TAP ON PADS  ***********************************/
 DJ202.handlePad = function(channel, control, value, status, group) {
    const isPressed = value === 0x7F;

    // Ignora rilascio per le funzioni normali (rilascio gestito solo in handleRoll)
    if (!isPressed && !(control >= 0x19 && control <= 0x20)) return;

    if (control >= 0x01 && control <= 0x08) {
        // HOTCUE
        DJ202.handleHotcue(control, group);
    } else if (control >= 0x09 && control <= 0x10) {
        // HOTCUE DELETE (SHIFT + PAD 1–8)
        DJ202.handleHotcueDelete(control, group);
    } else if (control >= 0x11 && control <= 0x18) {
        // LOOP (PAD 1–8 in modalità LOOP)
        DJ202.handleLoop(control, group);
    } else if (control >= 0x19 && control <= 0x1C) {
        // ROLL (SHIFT + PAD 1–4) → PAD temporaneo
        DJ202.handleRoll(control, group, isPressed);
    } else if (control >= 0x1D && control <= 0x20) {
        // ROLL altri (SHIFT + LOOP_IN, LOOP_OUT, ecc.)
        DJ202.handleRoll(control, group, isPressed);
    } else if (control >= 0x21 && control <= 0x28) {
        // SAMPLER
        DJ202.handleSampler(control, group);
    } else {
        print(`[WARNING] PAD sconosciuto. control=${control}`);
    }
};

// ********************* HOTCUE mode - PADs ***********************
DJ202.updateAllHotcueLeds = function(group) {
    for (let i = 0x01; i <= 0x08; i++) {
        DJ202.updateHotcuePadLed(i, group);
    }
};

DJ202.updateHotcuePadLed = function(control, group) {
    const index = control - 0x01;
    const hotcueSet = engine.getValue(group, `hotcue_${index + 1}_enabled`);

    if (hotcueSet) {
        DJ202.setPadLed(control, DJ202.PadsColor.YELLOW, group);
    } else {
        DJ202.setPadLed(control, DJ202.PadsColor.OFF, group);
    }
};

DJ202.handleHotcue = function(control, group) {
    const index = control - 0x01;
    engine.setValue(group, `hotcue_${index + 1}_activatecue`, true);
    DJ202.updateHotcuePadLed(control, group);
};

DJ202.handleHotcueDelete = function(control, group) {
    const index = control - 0x09;
    engine.setValue(group, `hotcue_${index + 1}_clear`, true);
    DJ202.updateHotcuePadLed(control - 0x08, group); // Corrisponde al pad normale (0x01 - 0x08)
};

// ********************* LOOP mode - PADs ***********************
DJ202.updateAllLoopLeds = function(group) {
    for (let i = 0x11; i <= 0x18; i++) {
        DJ202.updateLoopPadLed(i, group);
    }
};

DJ202.updateLoopPadLed = function(control, group) {
    const index = control - 0x11;
    const loopEnabled = engine.getValue(group, `loop_enabled`);

    if (loopEnabled) {
        DJ202.setPadLed(control, DJ202.PadsColor.YELLOW, group);
    } else {
        DJ202.setPadLed(control, DJ202.PadsColor.OFF, group);
    }
};


// Mappa delle dimensioni del loop per ogni PAD
DJ202.loopSizes = {
    0x11: 0.125, // PAD1 (0x11): 1/8
    0x12: 0.25,  // PAD2 (0x12): 1/4
    0x13: 0.5,    // PAD3 (0x13): 1/2
    0x14: 1,    // PAD4 (0x14): 1
    0x15: 2,    // PAD5 (0x15): 2
    0x16: 4,    // PAD6 (0x16): 4
    0x17: 8,   // PAD7 (0x17): 8
    0x18: 16    // PAD8 (0x18): 16
};

// Ogni pad ha uno stato per sapere se il loop è attivo o no
DJ202.padState = {
    0x11: false, // PAD1
    0x12: false, // PAD2
    0x13: false, // PAD3
    0x14: false, // PAD4
    0x15: false, // PAD5
    0x16: false, // PAD6
    0x17: false, // PAD7
    0x18: false  // PAD8
};

// Stato globale per il loop attivo
DJ202.loopActivePad = null;

DJ202.handleLoop = function(control, group) {
    const loopSize = DJ202.loopSizes[control];
    if (loopSize === undefined) {
        console.warn("PAD sconosciuto. Nessuna azione per control: ", control);
        return;
    }

    const loopEnabled = engine.getValue(group, "loop_enabled");

    if (!loopEnabled) {
        // Attiva il loop e salva il PAD attivo
        engine.setValue(group, "beatloop_" + loopSize, 1);
        DJ202.loopActivePad = control;
        DJ202.setPadLed(control, DJ202.PadsColor.YELLOW, group); // Accendi giallo
        console.log(`Loop attivato su PAD ${control} con dimensione ${loopSize}`);
    } else {
        if (DJ202.loopActivePad === control) {
            // Se premi lo stesso PAD, disattiva loop e spegni LED
            engine.setValue(group, "loop_enabled", false);
            DJ202.setPadLed(control, DJ202.PadsColor.OFF, group);
            DJ202.loopActivePad = null;
            console.log(`Loop disattivato su PAD ${control}`);
        } else {
            // Se premi un PAD diverso mentre loop è attivo:
            // Spegni LED del PAD precedente
            if (DJ202.loopActivePad !== null) {
                DJ202.setPadLed(DJ202.loopActivePad, DJ202.PadsColor.OFF, group);
            }
            // Cambia dimensione loop
            engine.setValue(group, "beatloop_" + loopSize, 1);
            DJ202.loopActivePad = control;
            DJ202.setPadLed(control, DJ202.PadsColor.YELLOW, group);
            console.log(`Loop esteso/modificato su PAD ${control} con dimensione ${loopSize}`);
        }
    }
};


// ********************* SAMPLER mode - PADs ***********************
DJ202.SAMPLER_DECKS = [
    { status: 0x94, base: 1  },  // Deck 1 → Sampler 1–8
    { status: 0x95, base: 9  },  // Deck 2 → Sampler 9–16
    { status: 0x96, base: 17 },  // Deck 3 → Sampler 17–24
    { status: 0x97, base: 25 }   // Deck 4 → Sampler 25–32
];

DJ202.initSamplerLeds = function() {
    DJ202.SAMPLER_DECKS.forEach(deck => {
        for (let pad = 0; pad < 8; pad++) {
            const samplerIndex = deck.base + pad;
            const group = `[Sampler${samplerIndex}]`;
            const control = 0x21 + pad;
            const status = deck.status;

            engine.makeConnection(group, "track_loaded", function(value) {
                if (value) {
                    const playing = engine.getValue(group, "play");
                    DJ202.setPadLed(
                        status,
                        control,
                        playing ? DJ202.PadsColor.RED : DJ202.PadsColor.YELLOW
                    );
                } else {
                    DJ202.setPadLed(status, control, DJ202.PadsColor.OFF);
                }
            });

            engine.makeConnection(group, "play", function(value) {
                if (!engine.getValue(group, "track_loaded")) return;
                DJ202.setPadLed(
                    status,
                    control,
                    value ? DJ202.PadsColor.RED : DJ202.PadsColor.YELLOW
                );
            });
        }
    });
};

DJ202.sampler = {
    handlePadSampler: function(channel, control, value, status) {
        if (value !== 0x7F) return;

        const deck = DJ202.SAMPLER_DECKS.find(d => d.status === status);
        if (!deck) return;

        const padIndex = control - 0x21; // 0–7
        const samplerIndex = deck.base + padIndex;
        const group = `[Sampler${samplerIndex}]`;

        if (!engine.getValue(group, "track_loaded")) {
            console.log(`⚠ Nessun campione in ${group}`);
            return;
        }

        engine.setValue(group, "cue_gotoandplay", 1);
        console.log(`▶ Avvio campione in ${group}`);
    },

    handleLevelKnob: function(channel, control, value) {
        const scaledValue = value / 32;

        for (let i = 1; i <= 32; i++) {
            engine.setValue(`[Sampler${i}]`, "pregain", scaledValue);
        }

        engine.setValue("[Sampler]", "pregain", scaledValue * 127);
    }
};



// ************************** SECONDARY FUNCTIONS (CueLoop, Roll, ecc...) *******************
// ********************* CUE LOOP mode - PADs ***********************


// ********************* ROLL mode - PADs ***********************
// Oggetto per tenere traccia dello stato reloop per ciascun deck
DJ202.reloopState = DJ202.reloopState || {};

DJ202.handleRoll = function(control, group, isPressed) {
    const inKeyMap = {
        0x1D: 'loop_in',
        0x1E: 'loop_out',
        0x1F: 'loop_remove',
        0x20: 'reloop_toggle',
    };

    // Inizializza stato reloop a OFF se non esiste per il deck
    if (!(group in DJ202.reloopState)) {
        DJ202.reloopState[group] = false;
    }

    if (DJ202.rollSizes && DJ202.rollSizes.hasOwnProperty(control)) {
        const loopSize = DJ202.rollSizes[control];
        if (isPressed) {
            engine.setValue(group, "beatlooproll_" + loopSize + "_activate", true);
            DJ202.setPadLed(control, DJ202.PadsColor.RED);
        } else {
            engine.setValue(group, "beatlooproll_" + loopSize + "_activate", false);
            engine.setValue(group, "beatloop_" + loopSize + "_enabled", false);
            DJ202.setPadLed(control, DJ202.PadsColor.OFF);
        }
        return;
    }

    if (inKeyMap.hasOwnProperty(control)) {
        if (isPressed) {
            engine.setValue(group, inKeyMap[control], 1);

            if (control === 0x1F) {
                // loop_remove: spegni tutti i LED loop
                DJ202.setPadLed(control, DJ202.PadsColor.OFF);
                DJ202.setPadLed(0x1D, DJ202.PadsColor.OFF);
                DJ202.setPadLed(0x1E, DJ202.PadsColor.OFF);
                DJ202.setPadLed(0x20, DJ202.PadsColor.OFF);
                DJ202.reloopState[group] = false; // reset stato reloop
            } 
            else if (control === 0x1E) {
                // PAD6 loop_out: accendi PAD6 e PAD8, attiva reloop ON
                DJ202.setPadLed(control, DJ202.PadsColor.RED);
                DJ202.setPadLed(0x20, DJ202.PadsColor.RED);
                DJ202.reloopState[group] = true;
            } 
            else if (control === 0x20) {
                // PAD8 premuto: toggle stato reloop e LED
                DJ202.reloopState[group] = !DJ202.reloopState[group];
                DJ202.setPadLed(control, DJ202.reloopState[group] ? DJ202.PadsColor.RED : DJ202.PadsColor.OFF);
            } 
            else {
                DJ202.setPadLed(control, DJ202.PadsColor.RED);
            }

        } else {
            // Rilascio PAD
            if (control === 0x1F) {
                DJ202.setPadLed(control, DJ202.PadsColor.OFF);
            } 
            else if (control === 0x20) {
                DJ202.setPadLed(control, DJ202.reloopState[group] ? DJ202.PadsColor.RED : DJ202.PadsColor.OFF);
            } 
            else {
                DJ202.setPadLed(control, DJ202.PadsColor.RED);
            }
        }
    }
};



// ********************* SLICER mode - PADs ***********************


// ********************* SEQUENCER ***********************
DJ202.Sequencer = function() {
    this.syncDeck = -1;

    const getActiveDeck = function() {
        const deckvolume = new Array(0, 0, 0, 0);
        let volumemax = -1;
        let newdeck = -1;

        // get volume from the decks and check it for use
        for (let z = 0; z <= 3; z++) {
            if (engine.getValue("[Channel" + (z + 1) + "]", "track_loaded") > 0) {
                deckvolume[z] = engine.getValue("[Channel" + (z + 1) + "]", "volume");
                if (deckvolume[z] > volumemax) {
                    volumemax = deckvolume[z];
                    newdeck = z;
                }
            }
        }

        return newdeck;
    };

    this.startStopButtonPressed = function(channel, control, value, status, _group) {
        if (status === 0xFA) {
            this.playbackCounter = 1;
            this.playbackTimer = engine.beginTimer(500, () => {
                midi.sendShortMsg(0xBA, 0x02, this.playbackCounter);
                this.playbackCounter = (this.playbackCounter % 4) + 1;
            });
        } else if (status === 0xFC) {
            if (this.playbackTimer) {
                engine.stopTimer(this.playbackTimer);
            }
        }
    };

   this.syncButtonPressed = function(channel, control, value, _status, _group) {
        if (value !== 0x7f) {
            return;
        }
        const isShifted = (control === 0x55);
        if (isShifted || this.syncDeck >= 0) {
            this.syncDeck = -1;
        } else {
            const deck = getActiveDeck();
            if (deck < 0) {
                return;
            }
            const bpm = engine.getValue("[Channel" + (deck + 1) + "]", "bpm");

            // Minimum BPM is 5.0 (0xEA 0x32 0x00), maximum BPM is 800.0 (0xEA 0x40 0x3e).
            if (!(bpm >= 5 && bpm <= 800)) {
                return;
            }
            const bpmValue = Math.round(bpm*10);
            midi.sendShortMsg(0xEA, bpmValue & 0x7f, (bpmValue >> 7) & 0x7f);
            this.syncDeck = deck;
        }
    };

    this.levelKnob = new components.Pot({
        group: "[Sampler1]",
        inKey: "volume",
        input: function(_channel, _control, _value, _status, _group) {
            components.Pot.prototype.input.apply(this, arguments);
            const volume = this.inGetParameter();
            for (let i = 1; i <= 16; i++) {
                engine.setValue("[Sampler" + i + "]", this.inKey, volume);
            }
        },
    });
    
    this.cueButton = new components.Button({
        group: "[Sampler1]",
        key: "pfl",
        type: components.Button.prototype.types.toggle,
        midi: [0x9F, 0x1D],
        input: function(_channel, _control, _value, _status, _group) {
            components.Button.prototype.input.apply(this, arguments);
            const pfl = this.inGetValue();
            for (let i = 1; i <= 16; i++) {
                engine.setValue("[Sampler" + i + "]", this.inKey, pfl);
            }
        },
    });
};
DJ202.Sequencer.prototype = Object.create(components.ComponentContainer.prototype);
