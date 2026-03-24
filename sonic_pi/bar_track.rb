# Polymarket Bar — Sonic Pi generative track
# Each live_loop is an independent instrument layer
# driven by a different Polymarket market via OSC

use_debug false
use_bpm 124

# ─── Global state ─────────────────────────────────────────
set :global_bpm,      124
set :market_resolved, 0     # 1=yes resolved, -1=no resolved
set :ambient_mode,    0

# ─── Global OSC listeners (one per parameter) ────────────
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

# ─── Layer state initialisation ───────────────────────────
[:kick, :bass, :pad, :lead, :atmos].each do |layer|
  set :"#{layer}_amp",     0.0
  set :"#{layer}_cutoff",  80.0
  set :"#{layer}_reverb",  0.3
  set :"#{layer}_density", 0.5
  set :"#{layer}_tone",    1
  set :"#{layer}_tension", 0.0
end

# ─── Per-layer OSC listeners (individual loop per param) ──
# This avoids the sequential sync stall from the original design.
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

# ─── KICK — market: activity rate drives pattern density ───
live_loop :kick do
  use_bpm get(:global_bpm)
  amp     = get(:kick_amp)
  density = get(:kick_density)

  if amp < 0.05
    sleep 1
  else
    # Four-on-the-floor baseline, with density adding ghost hits
    pattern = [1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0]
    ghost   = density > 0.6 ? [0,0,1,0, 0,0,0,1, 0,0,1,0, 0,1,0,0] : Array.new(16, 0)

    16.times do |i|
      sample :bd_haus, amp: amp * (pattern[i] == 1 ? 1.0 : 0.0)
      sample :bd_haus, amp: amp * 0.4 if ghost[i] == 1
      sleep 0.25
    end
  end
end

# ─── BASS — market probability drives root note ────────────
live_loop :bass do
  use_bpm get(:global_bpm)
  amp     = get(:bass_amp)
  cutoff  = get(:bass_cutoff)
  tone    = get(:bass_tone)
  tension = get(:bass_tension)

  if amp < 0.05
    sleep 1
  else
    use_synth :tb303
    root = tone == 1 ? :e2 : :d2    # yes-heavy market = E minor, no-heavy = D minor

    notes = tension > 0.5 ?
      chord(root, :diminished) :     # high spread = tense harmony
      chord(root, :minor)

    with_fx :lpf, cutoff: cutoff do
      with_fx :distortion, distort: tension * 0.3 do
        play notes.choose,
          release: [0.25, 0.5, 0.5, 1.0].choose,
          amp: amp * 0.9
      end
    end
    sleep [0.25, 0.5, 0.5, 0.5, 1.0].choose
  end
end

# ─── PAD — price velocity drives reverb/space ──────────────
live_loop :pad do
  use_bpm get(:global_bpm)
  amp    = get(:pad_amp)
  reverb = get(:pad_reverb)
  tone   = get(:pad_tone)
  cutoff = get(:pad_cutoff)

  if amp < 0.05
    sleep 4
  else
    use_synth :hollow
    scale_name = tone == 1 ? :minor : :phrygian   # minor=balanced, phrygian=doom

    with_fx :reverb, room: reverb, mix: 0.7 do
      with_fx :lpf, cutoff: cutoff + 5 do
        play scale(:e3, scale_name).choose,
          attack: 1.5, release: 3.0,
          amp: amp * 0.35
      end
    end
    sleep 8
  end
end

# ─── LEAD — trade rate drives melodic activity ─────────────
live_loop :lead do
  use_bpm get(:global_bpm)
  amp     = get(:lead_amp)
  density = get(:lead_density)
  cutoff  = get(:lead_cutoff)
  tone    = get(:lead_tone)

  if amp < 0.05
    sleep 0.5
  else
    use_synth :blade
    scale_notes = scale(:e4, tone == 1 ? :minor_pentatonic : :hungarian_minor)

    # High density markets get fast melodic bursts
    steps = density > 0.7 ? [0.25, 0.25, 0.5] : [0.5, 1.0, 1.0, 2.0]

    with_fx :echo, phase: 0.5, decay: 3, mix: 0.3 do
      with_fx :lpf, cutoff: cutoff + 10 do
        if one_in([2, 3, 4].choose)
          play scale_notes.choose, release: steps.choose, amp: amp * 0.5
        end
      end
    end
    sleep steps.choose
  end
end

# ─── ATMOSPHERE — global heat drives texture ───────────────
live_loop :atmosphere do
  use_bpm get(:global_bpm)
  amp    = get(:atmos_amp)
  reverb = get(:atmos_reverb)

  if amp < 0.05
    sleep 8
  else
    use_synth :dark_ambience
    with_fx :reverb, room: 0.99, mix: 0.85 do
      with_fx :hpf, cutoff: 30 do
        play [:e1, :b1, :e2, :g2].choose,
          attack: 4, release: 8,
          amp: amp * 0.2
      end
    end
    sleep 16
  end
end

# ─── MARKET RESOLVED — dramatic musical event ──────────────
live_loop :resolution_handler do
  use_real_time
  sync "/osc*/btc/global/market_resolved"

  resolved = get(:market_resolved)
  if resolved != 0
    if resolved == 1
      # YES resolved — triumphant ascending motif
      use_synth :piano
      [:e4, :g4, :b4, :e5].each do |note|
        play note, release: 0.3, amp: 1.2
        sleep 0.25
      end
      play :e5, release: 2.0, amp: 1.0
    else
      # NO resolved — descending bass drop
      use_synth :tb303
      [:b3, :g3, :e3, :b2].each do |note|
        play note, release: 0.4, amp: 1.0, cutoff: 70
        sleep 0.3
      end
    end

    set :market_resolved, 0   # reset
    sleep 4
  end
end

# ─── AMBIENT MODE — quiet background when nothing is hot ───
live_loop :ambient do
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
