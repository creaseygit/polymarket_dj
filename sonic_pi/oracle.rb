# @category alert
# @label Oracle

set :heat, 0.3
set :price, 0.5
set :price_delta, 0.0
set :velocity, 0.1
set :trade_rate, 0.2
set :spread, 0.2
set :tone, 1
set :event_spike, 0
set :event_price_move, 0
set :market_resolved, 0
set :ambient_mode, 0
set :sensitivity, 0.5

set_volume! 0.3

live_loop :price_watch do
  pd = get(:price_delta)
  t = get(:tone)
  v = get(:velocity)
  tr = get(:trade_rate)
  mag = pd.abs
  if mag > 0.1
    root = t == 1 ? :c4 : :a3
    sc = t == 1 ? :major : :minor
    num = 2 + (mag * 6).to_i
    num = [[num, 2].max, 6].min
    ns = scale(root, sc, num_octaves: 2)
    if pd > 0
      notes = ns.take(num)
    else
      notes = ns.take(num).reverse
    end
    activity = [0.3 + (v * 0.4) + (tr * 0.3), 1.0].min
    vol = [[0.02 + (mag * 0.06), 0.02].max, 0.05].min * activity
    hard = [[0.1 + (mag * 0.4), 0.1].max, 0.3].min
    with_fx :reverb, room: 0.6, damp: 0.5 do
      notes.each_with_index do |n, i|
        frac = i.to_f / [notes.length - 1, 1].max
        amp_env = pd > 0 ? vol * (0.7 + frac * 0.3) : vol * (1.0 - frac * 0.3)
        synth :piano, note: n, amp: amp_env * 0.95, hard: hard,
          vel: 0.2 + (mag * 0.5), pan: (frac - 0.5) * 0.3
        sleep 0.3
      end
    end
  end
  sleep 3
end
