# Polymarket Bar — Deep Bass Edition
# Based on Deep_Bass.rb by Martin Butz (mbutz)
# https://gist.github.com/mbutz/abb83d038fdcfe2a01752b54ea08e504
#
# Each layer is driven by Polymarket market data via OSC.
# The Python brain sends parameters to control amplitude,
# filter cutoff, reverb, density, tone, and tension.

use_bpm 125
set_sched_ahead_time! 1
use_debug false

# ─── Layer state initialisation (defaults = silent) ───────
[:kick, :bass, :pad, :lead, :atmos].each do |layer|
  set :"#{layer}_amp",     0.0
  set :"#{layer}_cutoff",  80.0
  set :"#{layer}_reverb",  0.3
  set :"#{layer}_density", 0.5
  set :"#{layer}_tone",    1
  set :"#{layer}_tension", 0.0
end

# ─── Global state ─────────────────────────────────────────
set :global_bpm,      125
set :market_resolved, 0
set :ambient_mode,    0

# ─── Global OSC listeners ────────────────────────────────
live_loop :global_bpm_listener do
  use_real_time
  b = sync "/osc*/btc/global/bpm"
  set :global_bpm, b[0] rescue nil
end

live_loop :global_resolved_listener do
  use_real_time
  r = sync "/osc*/btc/global/market_resolved"
  set :market_resolved, r[0] rescue nil
end

live_loop :global_ambient_listener do
  use_real_time
  a = sync "/osc*/btc/global/ambient_mode"
  set :ambient_mode, a[0] rescue nil
end

# ─── Per-layer OSC listeners (one loop per param) ─────────
[:kick, :bass, :pad, :lead, :atmos].each do |layer|
  live_loop :"#{layer}_amp_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/amp"
    set :"#{layer}_amp", v[0] rescue nil
  end

  live_loop :"#{layer}_cutoff_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/cutoff"
    set :"#{layer}_cutoff", v[0] rescue nil
  end

  live_loop :"#{layer}_reverb_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/reverb"
    set :"#{layer}_reverb", v[0] rescue nil
  end

  live_loop :"#{layer}_density_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/density"
    set :"#{layer}_density", v[0] rescue nil
  end

  live_loop :"#{layer}_tone_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/tone"
    set :"#{layer}_tone", v[0] rescue nil
  end

  live_loop :"#{layer}_tension_listener" do
    use_real_time
    v = sync "/osc*/btc/#{layer}/tension"
    set :"#{layer}_tension", v[0] rescue nil
  end

  live_loop :"#{layer}_command_listener" do
    use_real_time
    cmd = sync "/osc*/btc/#{layer}/command"
    case cmd[0]
    when "fade_in"
      set :"#{layer}_amp", 0.0
    when "fade_out"
      set :"#{layer}_amp", 0.0
    end
  end
end

# ─── Timer Loops (from Deep_Bass.rb) ──────────────────────
live_loop :atom do
  use_bpm get(:global_bpm)
  sleep 0.25
end

live_loop :bar, sync: :atom do
  use_bpm get(:global_bpm)
  sleep 4
end

live_loop :pattern, sync: :bar do
  use_bpm get(:global_bpm)
  sleep 16
end

# ─── KICK — pattern density driven by market trade rate ────
kick_pattern = (ring \
                2, 0, 0, 0,
                1.5, 0, 0, 0,
                1.5, 0, 0, 0.5,
                2, 0, 0, 0,
                1.5, 0, 0, 0,
                1.5, 0, 0, 2,
                1.5, 0.5, 0, 0,
                1.5, 0, 0, 1)

kick_cutoff_seq = (stretch [50, 70, 90, 110, 130], 128).mirror

live_loop :kick_play, sync: :pattern do
  use_bpm get(:global_bpm)
  amp = get(:kick_amp)
  density = get(:kick_density)
  cutoff_base = get(:kick_cutoff)

  if amp < 0.05
    sleep 0.25
  else
    use_synth :fm
    # Density controls whether ghost hits play
    k = kick_pattern.tick(:kick_pat)
    if k > 0
      play :c1, divisor: 1, attack: 0, sustain: 0, release: 1,
        cutoff: [cutoff_base, kick_cutoff_seq.look(:kick_cut)].min,
        depth: 0.1, amp: amp * k
    end
    # High density adds extra ghost kicks
    if density > 0.7 and one_in(3)
      play :c1, divisor: 1, attack: 0, sustain: 0, release: 0.5,
        cutoff: cutoff_base - 10, depth: 0.05, amp: amp * 0.3
    end
    sleep 0.25
  end
end

# ─── BASS — FM bass, market probability drives root note ───
bass_pulse = (stretch [0.01, 0.25, 0.25, 0.5], 4).ramp
bass_depth_seq = (stretch [0.5, 0.75, 1, 1, 1.5, 2], 4).mirror

live_loop :bass_play, sync: :bar do
  use_bpm get(:global_bpm)
  amp     = get(:bass_amp)
  cutoff  = get(:bass_cutoff)
  tone    = get(:bass_tone)
  tension = get(:bass_tension)

  if amp < 0.05
    sleep 4
  else
    use_synth :fm
    # Yes-heavy market (tone=1) = C root, No-heavy = Bb root
    root = tone == 1 ? :c1 : :bb0

    with_fx :slicer, phase: 1, smooth: 0.25, pulse_width: bass_pulse.tick(:bass_p) do
      with_synth_defaults divisor: 1, sustain: 4, depth: bass_depth_seq.look(:bass_d) do
        with_fx :distortion, distort: tension * 0.3 do
          play root, attack: 0, release: 0, cutoff: cutoff, amp: amp
        end
      end
    end
    sleep 4
  end
end

# ─── PAD (Hihat layer) — price velocity drives reverb ──────
hihat_amp_seq = (range 0, 0.15, step: 0.0005).mirror
hihat_rev_seq = (range 0, 0.5, step: 0.0025).reverse.mirror

live_loop :pad_play, sync: :pattern do
  use_bpm get(:global_bpm)
  amp    = get(:pad_amp)
  reverb = get(:pad_reverb)
  cutoff = get(:pad_cutoff)

  if amp < 0.05
    sleep 1
  else
    4.times do
      sleep 0.5
      with_fx :reverb, room: [1, reverb * 2].min, mix: reverb do
        sample :drum_cymbal_open, start: 0.025, finish: 0.175,
          rate: 1.1, pan: -0.3,
          amp: amp * hihat_amp_seq.tick(:hh_a)
      end
      sleep 0.5
    end
  end
end

# ─── LEAD — echo beeps, trade rate drives melodic density ──
live_loop :lead_play, sync: :bar do
  use_bpm get(:global_bpm)
  amp     = get(:lead_amp)
  density = get(:lead_density)
  cutoff  = get(:lead_cutoff)
  tone    = get(:lead_tone)

  if amp < 0.05
    sleep 4
  else
    use_synth :sine

    # Tone selects pitch set
    pitches = tone == 1 ?
      [:g5, :bb5, :c5, :eb5] :    # minor feel
      [:g5, :f5, :d5, :c5]        # darker phrygian feel

    with_fx :echo, phase: 0.5, decay: 5, mix: 0.25 do
      with_fx :lpf, cutoff: cutoff + 10 do
        # High density = more notes
        if density > 0.6 or one_in(3)
          play pitches.choose, amp: amp * 0.075, pan: [-0.75, 0.75, 0, 0].choose
          sleep 7.0 * 0.25
          play pitches.choose, amp: amp * 0.05, pan: [-0.75, 0.75, 0, 0].choose
          sleep 9.0 * 0.25
        else
          sleep 4
        end
      end
    end
  end
end

# ─── ATMOSPHERE — echo echo beep, global heat drives texture
eeb_amp_seq = (range 0, 0.5, step: 0.00005).mirror

live_loop :atmos_play, sync: :bar do
  use_bpm get(:global_bpm)
  amp    = get(:atmos_amp)
  reverb = get(:atmos_reverb)

  if amp < 0.05
    sleep 8
  else
    use_synth :sine
    sleep [8, 0.5, 1, 8].choose
    with_fx :echo, phase: 1, decay: [4, reverb * 8].max, mix: 0.75 do
      if one_in(3)
        sleep 1.0 * 0.25
        play :bb5, amp: amp * eeb_amp_seq.tick(:eeb), pan: [-1, 1, 0, 0].choose
        sleep 8.0 * 0.25
        play :bb5, amp: amp * eeb_amp_seq.look(:eeb), pan: [-1, 1, 0, 0].choose
        sleep 2.0 * 0.25
        play :c5, amp: amp * eeb_amp_seq.look(:eeb), pan: [-1, 1, 0, 0].choose
        sleep 5.0 * 0.25
      end
    end
  end
end

# ─── Shaker (bonus texture, tied to pad density) ──────────
live_loop :shaker_play, sync: :pattern do
  use_bpm get(:global_bpm)
  amp     = get(:pad_amp)
  density = get(:pad_density)

  if amp < 0.05 or density < 0.4
    sleep 4
  else
    use_synth :cnoise
    with_fx :slicer, phase: 0.25, pulse_width: 0.3 do
      with_fx :hpf, cutoff: 130 do
        play 60, attack: 0, sustain: 4, release: 0, amp: amp * 0.3
      end
    end
    sleep 4
  end
end

# ─── MARKET RESOLVED — dramatic musical event ─────────────
live_loop :resolution_handler do
  use_real_time
  sync "/osc*/btc/global/market_resolved"

  resolved = get(:market_resolved)
  if resolved != 0
    use_bpm get(:global_bpm)
    if resolved == 1
      # YES resolved — triumphant ascending motif
      use_synth :piano
      [:e4, :g4, :b4, :e5].each do |note|
        play note, release: 0.3, amp: 1.2
        sleep 0.25
      end
      play :e5, release: 2.0, amp: 1.0
    else
      # NO resolved — deep descending FM bass drop
      use_synth :fm
      [:b2, :g2, :e2, :c2].each do |note|
        play note, divisor: 1, depth: 2, release: 0.6, amp: 1.0, cutoff: 70
        sleep 0.3
      end
    end
    set :market_resolved, 0
    sleep 4
  end
end

# ─── AMBIENT MODE — quiet background when nothing is hot ───
live_loop :ambient_play do
  use_bpm get(:global_bpm)
  if get(:ambient_mode) != 1
    sleep 8
  else
    use_synth :dark_ambience
    with_fx :reverb, room: 0.99, mix: 0.9 do
      play scale(:e2, :minor).choose,
        attack: 6, release: 10,
        amp: 0.15
    end
    sleep 20
  end
end
