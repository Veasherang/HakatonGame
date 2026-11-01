/**
 * Списки музыкальных и звуковых файлов.
 * В автономной сборке те же ключи приходят из window.ATD_SOUNDS как data:URI.
 */
export const AUDIO_TRACKS = {
  menu: ['sounds/StartScreen/Project7.mp3'],
  ending: ['sounds/TheEnd/TheEnd.mp3'],
  ambient: [
    'sounds/processed/ambient_chord.wav',
    'sounds/processed/ambient_RachChords.wav',
    'sounds/processed/ambient_strength.wav',
    'sounds/processed/ambient_TheEnd.wav',
    'sounds/processed/ambient_creepySounds.wav',
    'sounds/Ambient/screamsFX.mp3',
  ],
  creepy: ['sounds/CreepySounds/creepysound.mp3'],
  jumpscare: [
    'sounds/Jumpscares/screamer1FX.mp3',
    'sounds/Jumpscares/screamer2FX.mp3',
    'sounds/Jumpscares/screamer3FX.mp3',
  ],
  siren: ['sounds/Siren/sirenFX.mp3'],
  voices: ['sounds/VoicesOfCreatures/whisper1.mp3', 'sounds/VoicesOfCreatures/whisper2.mp3'],
};

export const SOUND_FILES = [...new Set(Object.values(AUDIO_TRACKS).flat())];
