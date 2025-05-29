# Roland-DJ-202
Mapping - Roland DJ-202 controller

## based on "Roland Dj-202" controller implementation from

 * Silvio Ankermann <https://github.com/Lykos153>
 
## based on "Roland DJ-505" controller implementation from

 * Jan Holthuis <https://github.com/Holzhaus>
 
 All standard features seems working out of the box
 
 - 4 Deck control possible
- Select and load tracks from within the controller
- use pad buttons for:
  - hotcues 
  - loops
  - rolls
  - effects and samples
  - sequencer

## Usage

Just copy the *xml and *js files into the controller directory under your mixxx profile. Select "Roland_DJ-202_test202" as your controller and give it a try.

### Controller:

#### Deck section

#### PAD modes

change between differerent PAD modes with <code>Transition FX</code>

| Mode | Indication |
| ---- | ---- |
| Hotcue | <code>Transition FX</code> off |
| Loop | <code>Transition FX</code> on |
| Effect | <code>Transition FX</code> blinking |
| Jump | <code>Transition FX</code> and all <code>PAD</code>s blinking |
 
| Mode | Control | Function |
| ---- | ---- | ---- |
| Hotcue | <code>PAD</code> 1 - 8 | Set (if empty) or Preview/Play (if set) hot cue point / loop 1 - 8 |
| Hotcue | <code>SHIFT</code><code>PAD</code> 1 - 8 | Clear hot cue 1 - 8 |
| Loop | <code>PAD</code> 1 - 8 | Set and enables or stops loop over beats (increasing size PADs 1-8) |
| Loop | <code>PAD</code> 1 - 8 | Clear loop 1-8 |
| Roll | <code>PAD</code> 1 - 4 | Play (if pressed)/Stop(if release pad) Temp loop 1 - 4 |
| Roll | <code>PAD</code>, <code>SHIFT</code><code>PAD</code> 5 - 8 | Activate IN, OUT, EXIT, ON/OFF |

#### Mixer section

| No. | Control | Function |
| ------------------------------------------------- | ----------------------------- | ------ |


## TODOs

- [ ] Configure CUE LOOP pads
- [ ] Configure SLICER pads 
- [ ] Investigate for bugs
- [ ] Clean up XML (delete commented out outputs)
- [ ] Clean up JS
- [x] Post in [Controller mappings forum]
- [ ] See if anything needs to be done with SAMPLER pads
- [ ] See if anything needs to be done with PARAM +/-
- [ ] Update code comments as needed
- [ ] Configure VU meter
- [x] Update README with instructions
