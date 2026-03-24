# Market Pulse v2 — Polymarket Generative Track
# Richer version: TB303 bass, layered pads, stepwise lead, slicer atmos

use_bpm 120
use_debug false
set_volume! 0.7

[:kick, :bass, :pad, :lead, :atmos].each do |layer|
  set :"#{layer}_amp",     0.4
  set :"#{layer}_cutoff",  80.0
  set :"#{layer}_reverb",  0.3
  set :"#{layer}_density", 0.5
  set :"#{layer}_tone",    1
  set :"#{layer}_tension", 0.0
end

set :market_resolved, 0
set :ambient_mode,    0
set :lead_note_idx,   0

MAJOR_CHORDS = [chord(:e3, :major7), chord(:a3, :major7), chord(:d3, :maj9), chord(:b2, :major7)]
MINOR_CHORDS = [chord(:e3, :minor7), chord(:a3, :minor7), chord(:d3, :minor7), chord(:g3, :m9)]
MAJOR_SCALE = scale(:e4, :major_pentatonic, num_octaves: 2)
MINOR_SCALE = scale(:e4, :minor_pentatonic, num_octaves: 2)
MAJOR_ROOTS = (ring :e2, :a2, :d2, :b1)
MINOR_ROOTS = (ring :e2, :a2, :d2, :g2)

define :scale_val do |val, in_lo, in_hi, out_lo, out_hi|
  span = (in_hi - in_lo).to_f
  span = 0.0001 if span < 0.0001
  n = (val - in_lo) / span
  n = 0.0 if n < 0.0
  n = 1.0 if n > 1.0
  out_lo + n * (out_hi - out_lo)
end

live_loop :kick_loop do
  amp     = get(:kick_amp)
  density = get(:kick_density)

  if amp < 0.05
    sleep 1
  else
    sample :bd_tek, amp: amp * 0.7, cutoff: 100
    sample :bd_haus, amp: amp * 0.3, cutoff: 70, rate: 0.8 if density > 0.3
    sleep 0.52
    if density > 0.4
      sample :bd_tek, amp: amp * 0.2, cutoff: 75, rate: 1.05
    end
    sleep 0.48
    sample :bd_tek, amp: amp * 0.6, cutoff: 95
    sleep 0.52
    if density > 0.7
      sample :bd_tek, amp: amp * 0.15, cutoff: 65, rate: 1.1
    end
    sleep 0.48
  end
end

live_loop :hihat_loop do
  amp     = get(:kick_amp)
  density = get(:kick_density)

  if amp < 0.05
    sleep 0.25
  else
    vel_ring = (ring 0.5, 0.35, 0.45, 0.3, 0.55, 0.3, 0.4, 0.25,
                     0.5, 0.3, 0.45, 0.35, 0.55, 0.3, 0.4, 0.3)
    16.times do |i|
      d = get(:kick_density)
      a = get(:kick_amp)
      if rand < (d * 0.8 + 0.1)
        sample :drum_cymbal_closed,
          amp: a * 0.18 * vel_ring[i],
          rate: rrand(1.1, 1.4),
          finish: 0.08,
          pan: rrand(-0.15, 0.15)
      end
      if one_in(10) and d > 0.5
        sample :drum_cymbal_open,
          amp: a * 0.1, rate: 1.3, finish: 0.12,
          pan: rrand(-0.3, 0.3)
      end
      sleep 0.25
    end
  end
end

live_loop :bass_loop do
  amp     = get(:bass_amp)
  cutoff  = get(:bass_cutoff)
  tone    = get(:bass_tone)
  tension = get(:bass_tension)
  density = get(:bass_density)

  if amp < 0.05
    sleep 2
  else
    roots = tone == 1 ? MAJOR_ROOTS : MINOR_ROOTS
    root = roots.tick(:bass_root)
    res = scale_val(tension, 0, 1, 0.2, 0.85)
    use_synth :tb303
    if density > 0.6
      4.times do |i|
        n = i.even? ? root : root + 12
        play n, amp: amp * 0.5, release: 0.2,
          cutoff: [cutoff - 10, 60].max + (i * 3), res: res, wave: 0
        sleep 0.5
      end
    else
      with_fx :lpf, cutoff: [cutoff, 90].min do
        play root, amp: amp * 0.55, attack: 0.05, sustain: 1.2, release: 0.6,
          cutoff: [cutoff, 85].min, res: res * 0.5, wave: 1
      end
      sleep 2
    end
  end
end

live_loop :pad_loop do
  amp     = get(:pad_amp)
  reverb  = get(:pad_reverb)
  tone    = get(:pad_tone)
  cutoff  = get(:pad_cutoff)
  tension = get(:pad_tension)

  if amp < 0.05
    sleep 8
  else
    chords = tone == 1 ? MAJOR_CHORDS : MINOR_CHORDS
    c = chords.tick(:pad_chord)
    with_fx :reverb, room: [reverb, 0.92].min, mix: 0.55, damp: 0.4 do
      with_fx :hpf, cutoff: 55 do
        filt = cutoff + 15 - (tension * 20)
        with_fx :lpf, cutoff: [filt, 65].max do
          use_synth :hollow
          c.each_with_index do |n, i|
            play n, amp: amp * 0.15, attack: 1.5 + (i * 0.2),
              sustain: 5, release: 2.5, pan: (i - 1.5) * 0.25
          end
          use_synth :dsaw
          play c[0], amp: amp * 0.06, attack: 2.0, sustain: 4,
            release: 3, detune: 0.12, cutoff: [cutoff + 5, 110].min, pan: -0.3
          play c[2] || c[1], amp: amp * 0.06, attack: 2.0, sustain: 4,
            release: 3, detune: 0.08, cutoff: [cutoff + 5, 110].min, pan: 0.3
        end
      end
    end
    sleep 8
  end
end

live_loop :lead_loop do
  amp     = get(:lead_amp)
  density = get(:lead_density)
  cutoff  = get(:lead_cutoff)
  tone    = get(:lead_tone)
  reverb  = get(:lead_reverb)

  if amp < 0.05
    sleep 1
  else
    use_synth :prophet
    notes = tone == 1 ? MAJOR_SCALE : MINOR_SCALE
    num_notes = notes.size
    with_fx :reverb, room: [reverb * 0.7, 0.65].min, mix: 0.35 do
      with_fx :echo, phase: 0.75, decay: 4, mix: 0.3 do
        with_fx :hpf, cutoff: 65 do
          with_fx :lpf, cutoff: cutoff + 20 do
            phrase_len = density > 0.6 ? rrand_i(3, 6) : rrand_i(1, 3)
            phrase_len.times do |step|
              if density > 0.4 or one_in(3)
                idx = get(:lead_note_idx) || 0
                movement = [-2, -1, -1, 0, 1, 1, 2].choose
                idx = (idx + movement) % num_notes
                set :lead_note_idx, idx
                play notes[idx], amp: amp * 0.28, attack: 0.02,
                  release: [0.4, 0.7, 1.0, 1.5].choose,
                  cutoff: cutoff + rrand_i(-5, 15), pan: rrand(-0.35, 0.35)
              end
              sleep density > 0.7 ? [0.25, 0.5, 0.5].choose : [0.5, 1.0, 0.75].choose
            end
            sleep density > 0.6 ? rrand(0.5, 1.5) : rrand(1.0, 3.0)
          end
        end
      end
    end
  end
end

live_loop :atmos_loop do
  amp     = get(:atmos_amp)
  reverb  = get(:atmos_reverb)
  tone    = get(:atmos_tone)
  density = get(:atmos_density)
  tension = get(:atmos_tension)

  if amp < 0.05
    sleep 8
  else
    root = tone == 1 ? :e2 : :d2
    notes = [root, root + 7, root + 12, root + 19]
    slicer_phase = density > 0.5 ? 0.25 : 0.5
    with_fx :reverb, room: 0.95, mix: 0.8, damp: 0.3 do
      with_fx :slicer, phase: slicer_phase, wave: 3, amp_min: 0.1, amp_max: 1.0, probability: 0.85 do
        with_fx :lpf, cutoff: 70 + (tension * 15) do
          use_synth :hollow
          play notes.choose, amp: amp * 0.12, attack: 3, sustain: 6, release: 4
          use_synth :sine
          play root - 12, amp: amp * 0.06, attack: 4, sustain: 5, release: 4
        end
      end
    end
    sleep 12
  end
end

live_loop :texture_loop do
  amp     = get(:pad_amp)
  density = get(:pad_density)
  tone    = get(:pad_tone)
  cutoff  = get(:pad_cutoff)

  if amp < 0.05 or density < 0.25
    sleep 4
  else
    notes = tone == 1 ? MAJOR_SCALE : MINOR_SCALE
    with_fx :reverb, room: 0.75, mix: 0.5 do
      with_fx :echo, phase: 0.375, decay: 4, mix: 0.3 do
        burst = rrand_i(2, 4)
        burst.times do
          if one_in(2)
            use_synth :blade
            play notes.choose + 12, amp: amp * 0.07, attack: 0.01,
              release: rrand(0.15, 0.4), cutoff: [cutoff + 10, 120].min,
              pan: rrand(-0.6, 0.6)
          end
          sleep [0.25, 0.375, 0.5].choose
        end
        sleep rrand(1.0, 3.0)
      end
    end
  end
end

live_loop :perc_loop do
  amp     = get(:kick_amp)
  density = get(:kick_density)

  if amp < 0.05 or density < 0.3
    sleep 2
  else
    8.times do
      d = get(:kick_density)
      a = get(:kick_amp)
      if rand < d * 0.5
        sample :drum_cymbal_closed, amp: a * 0.04,
          rate: rrand(2.5, 3.5), finish: 0.04, pan: rrand(0.2, 0.5)
      end
      if one_in(8) and d > 0.4
        sample :elec_blip, amp: a * 0.06,
          rate: rrand(1.0, 1.5), pan: rrand(-0.4, -0.1)
      end
      if one_in(16) and d > 0.6
        sample :drum_snare_hard, amp: a * 0.04, rate: 1.2, finish: 0.2
      end
      sleep 0.25
    end
  end
end

live_loop :resolution_check do
  resolved = get(:market_resolved)
  if resolved != 0
    use_synth :prophet
    if resolved == 1
      with_fx :reverb, room: 0.85, mix: 0.5 do
        with_fx :echo, phase: 0.25, decay: 3, mix: 0.2 do
          [:e4, :b4, :e5, :g5, :b5].each_with_index do |n, i|
            play n, amp: 0.35, release: 2.0 - (i * 0.3), pan: (i - 2) * 0.2
            sleep 0.15
          end
          play :e6, amp: 0.3, release: 4.0
        end
      end
    else
      with_fx :reverb, room: 0.9, mix: 0.6 do
        [:b4, :g4, :e4, :d4, :b3, :e3].each_with_index do |n, i|
          play n, amp: 0.35, release: 1.2, cutoff: 90 - (i * 8)
          sleep 0.2
        end
      end
    end
    set :market_resolved, 0
    sleep 4
  else
    sleep 1
  end
end

live_loop :ambient_check do
  if get(:ambient_mode) == 1
    with_fx :reverb, room: 0.98, mix: 0.85 do
      with_fx :echo, phase: 1.5, decay: 6, mix: 0.3 do
        use_synth :hollow
        play scale(:e2, :minor).choose, amp: 0.07, attack: 6, release: 12
        use_synth :sine
        play scale(:e5, :minor).choose, amp: 0.03, attack: 4,
          release: 8, pan: rrand(-0.5, 0.5)
      end
    end
    sleep 16
  else
    sleep 4
  end
end
