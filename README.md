# Note Garden

A Level 1 music course for kids. Pip the bird listens through the microphone to check each note a child plays. The course adapts as they learn: color, letter and piano-key helpers fade away as notes are mastered, and tempos and difficulty follow how the child is doing.

Open `index.html` (directly or from any static server), click **Listen to my instrument**, and play. Any instrument works, since octave doesn't matter. Without a microphone, use the on-screen piano or the computer keys A S D F G H J K. Tapping low on a key plays loud and tapping high plays soft.

## Level 1

There are 36 lessons in 7 units:

| Unit | Covers |
| --- | --- |
| 1. Hello, Music! | High and low, steady beat, black key groups |
| 2. Middle C | Finding C, lines and spaces, first song |
| 3. D and E | D and E on the piano and staff, steps and repeats, Hot Cross Buns |
| 4. Counting Beats | Quarter, half and whole notes, quarter rests, Au Clair de la Lune |
| 5. F and G | Five-finger C position, note reading, Ode to Joy |
| 6. Loud and Soft | Forte and piano, skips, rhythm mix, Mary Had a Little Lamb, Lightly Row, When the Saints |
| 7. Meet A, Then the Recital | A, Jingle Bells, Twinkle Twinkle, the recital and a printable certificate |

There are four lesson types:

- **Songs:** "Learn it" waits for each note and earns up to 2 stars. "Play with the beat" adds a count-in, metronome and moving playhead, and judges timing. Getting 80% of the notes on the beat earns the third star.
- **Rhythm:** Pip claps the pattern first. Then the child taps the drum, presses Space, or claps if the microphone is on. Taps are judged against the beat.
- **Quizzes:** listening and reading questions, such as high or low, black key groups, finding keys, lines and spaces, steps, skips and repeats, note values, note names, and forte and piano.
- **Star checks:** mixed quizzes at the end of units. The last one is the recital.

## Files

- `js/music.js` handles note parsing, song notation (`"E D C:h | ..."`) and staff/keyboard SVG drawing.
- `js/audio.js` covers tones, clicks, claps, Pip's voice (Web Speech), and microphone pitch and onset detection.
- `js/curriculum.js` holds the songs, rhythms and the Level 1 lesson path.
- `js/activities.js` contains the song, rhythm and quiz players plus the question generators.
- `js/games.js` has Echo Bird and Bubble Pop.
- `js/app.js` covers progress, the map, the lesson frame, the piano dock, grown-ups and the certificate.

Progress is saved in the browser's localStorage.

## Pip's voice

Everything Pip says is pre-recorded with the open-source [Kokoro](https://github.com/hexgrad/kokoro) text-to-speech model (voice `af_heart`, Apache 2.0) and stored in `voice/` as small MP3s, one per sentence. If a sentence has no recording, Pip falls back to the most natural voice the browser offers.

To re-record after changing any text: run `node tools/voice/catalog.mjs` to list every sentence and update `voice/manifest.js`, then run `python tools/voice/render.py . <kokoro model dir>` to record only the new sentences. That step needs `kokoro-onnx`, `soundfile` and ffmpeg.
