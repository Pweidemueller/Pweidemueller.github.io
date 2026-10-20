(function () {
  "use strict";

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const tooltip = d3.select("#tooltip");
  function showTooltip(html, event) {
    tooltip.style("opacity", 1).html(html)
      .style("left", (event.clientX + 14) + "px")
      .style("top", (event.clientY + 14) + "px");
  }
  function hideTooltip() { tooltip.style("opacity", 0); }

  // ---------------------------------------------------------------------
  // Per-experiment text content and setup-tile builders
  // ---------------------------------------------------------------------
  const EXPERIMENT_TEXT = {
    rate: {
      heading: "Fixed birth and death rate, variable sampling rate",
      intro: `Two birth-death-sampling simulations sharing the same birth rate, death rate and sequence mutation
        rate, and the same fixed simulation duration &mdash; only the <strong>sampling rate</strong> differs. Each
        removal event (death or sampling) is stochastic, so a higher sampling rate does not just add samples: it
        adds to the total rate at which infected individuals are removed, so it also changes which outbreak you
        end up looking at.`,
      reactionsNote: `Reactions: <code>X &rarr; 2X</code> (birth), <code>X &rarr; dead</code> (death, unsampled
        removal), <code>X &rarr; sample</code> (sampling).`,
      buildSetupTiles: (p, maxTime) => [
        ["Birth rate", p.birth_rate, "shared, fixed"],
        ["Death rate", p.death_rate, "shared, fixed"],
        ["Sampling rate", `${p.sampling_rate_low} vs ${p.sampling_rate_high}`, "low vs high"],
        ["Mutation rate", p.mutation_rate, "subs/site/time, shared"],
        ["Duration", maxTime, "time units, both regimes"],
        ["Sequence length", p.sequence_length, "bp, Jukes-Cantor"],
      ],
      outbreakIntro: `Both simulations ran for the same fixed 30 time units &mdash; neither outbreak was forced to
        stop early or capped at a sample size. But a higher sampling rate adds to the <em>total</em> rate at which
        infected individuals are removed (death + sampling), so each infected individual stays infectious for a
        shorter average time. With the same birth rate, that leaves less time for onward transmission before
        removal, so the high-sampling outbreak simply doesn't reach as far in the same window.`,
      outbreakCallout: {
        label: "Neither outbreak went extinct",
        value: (maxTime) => `both still growing at t = ${maxTime}`,
        sub: `this is the SAME fixed observation window for both &mdash; the gap in reach is entirely from the
          faster removal rate under high sampling`,
      },
      dashHighLine: false,
      diversityIntro: `Pairwise Hamming distances across all sampled sequences in each regime. More mass near zero
        means more near-identical sequences (recent, tightly-linked transmission); a wider spread means the sample
        has picked up more independent, deeper branches of the outbreak. The outbreak sizes themselves differ here
        too (see above), so this reflects both a sampling-density effect and an outbreak-size effect together.`,
      timingIntro: `Sample collection times, binned into equal-width windows across the simulation. Bars show each
        regime's <em>share</em> of its own samples per bin (so the two regimes, with different total sample sizes,
        are directly comparable) &mdash; does higher sampling pull relatively more sequences from earlier in the
        outbreak, or does it concentrate near the end?`,
    },
    proportion: {
      heading: "Fixed R and becoming-uninfectious rate, variable sampling proportion",
      intro: `Same reproduction number <strong>R</strong> (birth rate &divide; becoming-uninfectious rate) and the
        same <strong>becoming-uninfectious rate</strong> (death rate + sampling rate) in both runs &mdash; only the
        <strong>sampling proportion</strong> p = sampling rate &divide; (death + sampling rate) differs. Because R
        and the total removal rate are unchanged, the birth rate and total removal rate are IDENTICAL between the
        two runs, so they were deliberately simulated with the <em>same random seed</em>: it is literally the same
        outbreak, only the label on each removed lineage ("died" vs "sampled") differs.`,
      reactionsNote: `Reactions: <code>X &rarr; 2X</code> (birth, rate = R &times; becoming-uninfectious rate),
        <code>X &rarr; dead</code> / <code>X &rarr; sample</code> splitting that same fixed becoming-uninfectious
        rate according to the sampling proportion p.`,
      buildSetupTiles: (p, maxTime) => [
        ["R (reproduction number)", p.R, "shared, fixed"],
        ["Becoming-uninfectious rate", p.becoming_uninfectious_rate, "δ = death + sampling, shared, fixed"],
        ["Sampling proportion", `${p.sampling_proportion_low} vs ${p.sampling_proportion_high}`, "low vs high (p)"],
        ["Birth rate", p.birth_rate, "= R × δ, shared, fixed"],
        ["Sampling rate", `${p.sampling_rate_low} vs ${p.sampling_rate_high}`, "= p × δ, derived"],
        ["Death rate", `${p.death_rate_low} vs ${p.death_rate_high}`, "= (1−p) × δ, derived"],
        ["Mutation rate", p.mutation_rate, "subs/site/time, shared"],
        ["Duration", maxTime, "time units, both regimes"],
      ],
      outbreakIntro: `Because R and the becoming-uninfectious rate are fixed, the birth rate and total removal rate
        are identical between the two runs &mdash; and since they share the same random seed, the underlying
        outbreak (who is infected, and when) is exactly the same in both. The two lines below trace the same path;
        the high-proportion line is dashed so both remain visible.`,
      outbreakCallout: {
        label: "Same outbreak, by design",
        value: () => "identical reach in both regimes",
        sub: `both curves trace the same underlying epidemic (same seed, same birth &amp; total removal rate) &mdash;
          only which removed lineages get labelled "sampled" differs`,
      },
      dashHighLine: true,
      diversityIntro: `Pairwise Hamming distances, same measure as before &mdash; but this time the underlying
        outbreak is identical in both regimes (see above), so any remaining difference is purely a
        <strong>sampling-density</strong> effect, not a difference in outbreak size or speed.`,
      timingIntro: `Sample collection times, binned into equal-width windows &mdash; again over the very same
        underlying outbreak, so this isolates how sampling proportion alone reshapes which part of the outbreak's
        history ends up represented in the sample.`,
    },
  };

  function experimentSectionHTML(key, text) {
    return `
      <div class="mega-heading">
        <h1>${text.heading}</h1>
        <p class="lede">${text.intro}</p>
      </div>

      <section id="setup-${key}">
        <div class="card">
          <h3>Simulation setup</h3>
          <div class="stat-row" id="setup-stats-${key}"></div>
          <p class="lede" style="margin:0">
            ${text.reactionsNote} Sequences (1000bp, Jukes-Cantor) were simulated along the reconstructed tree of
            sampled tips only. XML inputs are in
            <a href="https://github.com/Pweidemueller/birthdeath_diversity/tree/main/xml" target="_blank" rel="noopener"><code>xml/</code></a>, raw outputs in
            <a href="https://github.com/Pweidemueller/birthdeath_diversity/tree/main/results" target="_blank" rel="noopener"><code>results/</code></a> &mdash; see
            <a href="https://github.com/Pweidemueller/birthdeath_diversity/blob/main/scripts/run_simulations.sh" target="_blank"
              rel="noopener"><code>scripts/run_simulations.sh</code></a> to reproduce.
          </p>
        </div>
      </section>

      <section id="outbreak-reach-${key}">
        <div class="section-head">
          <h2>How far did each outbreak get?</h2>
          <p>${text.outbreakIntro}</p>
        </div>
        <div class="stat-row" id="outbreak-stats-${key}"></div>
        <div class="card">
          <div class="legend" id="outbreak-legend-${key}"></div>
          <div class="grid-2">
            <div>
              <h3>Cumulative infections (reach so far)</h3>
              <div id="outbreak-cumulative-viz-${key}"></div>
            </div>
            <div>
              <h3>Currently-infected count (active lineages)</h3>
              <div id="outbreak-active-viz-${key}"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="diversity-${key}">
        <div class="section-head">
          <h2>Genetic diversity of the sampled sequences</h2>
          <p>${text.diversityIntro}</p>
        </div>
        <div class="stat-row" id="diversity-stats-${key}"></div>
        <div class="card">
          <div class="legend" id="diversity-legend-${key}"></div>
          <div id="diversity-viz-${key}"></div>
        </div>
      </section>

      <section id="timing-${key}">
        <div class="section-head">
          <h2>When were the sampled sequences taken?</h2>
          <p>${text.timingIntro}</p>
        </div>
        <div class="card">
          <div class="legend" id="timing-legend-${key}"></div>
          <div id="timing-viz-${key}"></div>
        </div>
      </section>`;
  }

  // ---------------------------------------------------------------------
  // Setup stat tiles
  // ---------------------------------------------------------------------
  function renderSetupStats(key, text, data) {
    const tiles = text.buildSetupTiles(data.params, REGIMES.max_time);
    document.getElementById(`setup-stats-${key}`).innerHTML = tiles.map(([label, value, sub]) => `
      <div class="stat-tile">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
        <div class="sub">${sub}</div>
      </div>`).join("");
  }

  // ---------------------------------------------------------------------
  // Outbreak reach over time (cumulative infections + active count)
  // ---------------------------------------------------------------------
  function renderOutbreakReach(key, text, data) {
    const regimes = [
      { key: "low", label: "Low sampling", color: cssVar("--series-low"), data: data.low, dash: false },
      { key: "high", label: "High sampling", color: cssVar("--series-high"), data: data.high, dash: text.dashHighLine },
    ];

    document.getElementById(`outbreak-legend-${key}`).innerHTML = regimes.map((r) => `
      <span class="item"><span class="swatch" style="background:${r.color}"></span>${r.label}</span>`).join("");

    const callout = text.outbreakCallout;
    document.getElementById(`outbreak-stats-${key}`).innerHTML = regimes.map((r) => `
      <div class="stat-tile ${r.key}">
        <div class="label">${r.label} &mdash; at t = ${REGIMES.max_time}</div>
        <div class="value">${r.data.n_total_infections} infected so far</div>
        <div class="sub">${r.data.still_active_at_end.toFixed(0)} still actively infectious &middot;
          mean infectious duration ${r.data.mean_infectious_duration.toFixed(2)} time units</div>
      </div>`).join("")
      + `
      <div class="stat-tile">
        <div class="label">${callout.label}</div>
        <div class="value" style="font-size:15px">${callout.value(REGIMES.max_time)}</div>
        <div class="sub">${callout.sub}</div>
      </div>`;

    function lineChart(container, accessor, yLabel) {
      const margin = { top: 10, right: 20, bottom: 34, left: 46 };
      const width = 420, height = 240;
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const allPoints = regimes.flatMap((r) => r.data.trajectory.map(accessor));
      const x = d3.scaleLinear().domain([0, REGIMES.max_time]).range([0, innerW]);
      const y = d3.scaleLinear().domain([0, d3.max(allPoints, (d) => d.y)]).nice().range([innerH, 0]);

      const svg = d3.select(container).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%")
        .style("display", "block").style("height", "auto");
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      g.append("g").attr("class", "gridline")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
        .call((sel) => sel.select(".domain").remove());

      const line = d3.line().x((d) => x(d.x)).y((d) => y(d.y));

      regimes.forEach((r) => {
        const pts = r.data.trajectory.map(accessor);
        g.append("path")
          .datum(pts)
          .attr("fill", "none")
          .attr("stroke", r.color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", r.dash ? "5,4" : null)
          .attr("d", line);

        const last = pts[pts.length - 1];
        g.append("circle")
          .attr("cx", x(last.x)).attr("cy", y(last.y)).attr("r", 3.5)
          .attr("fill", r.color);

        // invisible hover strip for a crosshair-ish tooltip on the endpoint + a mid sample
        g.append("rect")
          .attr("x", 0).attr("y", 0).attr("width", innerW).attr("height", innerH)
          .attr("fill", "transparent")
          .on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const t0 = x.invert(mx);
            const bisect = d3.bisector((d) => d.x).left;
            const i = bisect(pts, t0);
            const d = pts[Math.max(0, Math.min(pts.length - 1, i))];
            showTooltip(`<strong>${r.label}</strong><br>t = ${d.x.toFixed(1)}<br>${yLabel}: ${d.y.toFixed(0)}`, event);
          })
          .on("mouseleave", hideTooltip);
      });

      const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(6));
      xAxisG.selectAll("text").attr("class", "tick-label");
      g.append("text").attr("class", "axis-label")
        .attr("x", innerW / 2).attr("y", innerH + 30).attr("text-anchor", "middle")
        .text("simulation time");

      const yAxisG = g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
      yAxisG.selectAll("text").attr("class", "tick-label");
      g.append("text").attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerH / 2).attr("y", -34).attr("text-anchor", "middle")
        .text(yLabel);
    }

    lineChart(`#outbreak-cumulative-viz-${key}`, (d) => ({ x: d.t, y: d.total_infections }), "total infected so far");
    lineChart(`#outbreak-active-viz-${key}`, (d) => ({ x: d.t, y: d.active }), "currently infectious");
  }

  // ---------------------------------------------------------------------
  // Pairwise distance histograms (low vs high)
  // ---------------------------------------------------------------------
  function renderDiversity(key, text, data) {
    const regimes = [
      { key: "low", label: "Low sampling", color: cssVar("--series-low"), data: data.low },
      { key: "high", label: "High sampling", color: cssVar("--series-high"), data: data.high },
    ];

    const statsEl = document.getElementById(`diversity-stats-${key}`);
    statsEl.innerHTML = regimes.map((r) => `
      <div class="stat-tile ${r.key}">
        <div class="label">${r.label}</div>
        <div class="value">${r.data.n_sampled} sampled</div>
        <div class="sub">${r.data.n_unique_haplotypes} unique sequences &middot;
          mean dist ${r.data.mean_pairwise_distance.toFixed(1)} bp
          (${(r.data.nucleotide_diversity * 100).toFixed(2)}%)</div>
      </div>`).join("")
      + `
      <div class="stat-tile">
        <div class="label">Outbreak captured</div>
        <div class="value" style="font-size:16px">${(data.low.sampling_fraction_of_outbreak * 100).toFixed(0)}% vs ${(data.high.sampling_fraction_of_outbreak * 100).toFixed(0)}%</div>
        <div class="sub">of ${data.low.n_total_infections} vs ${data.high.n_total_infections} total infections</div>
      </div>`;

    document.getElementById(`diversity-legend-${key}`).innerHTML = regimes.map((r) => `
      <span class="item"><span class="swatch" style="background:${r.color}"></span>${r.label}</span>`).join("");

    const allDists = regimes.flatMap((r) => r.data.pairwise_distances);
    const maxDist = d3.max(allDists);
    const margin = { top: 10, right: 20, bottom: 34, left: 44 };
    const width = 860, height = 260;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([0, maxDist]).nice().range([0, innerW]);
    const binGen = d3.bin().domain(x.domain()).thresholds(24);

    // Share of that regime's own pairs, not raw counts -- the two regimes can
    // have very different total pair counts (n choose 2), so raw counts would
    // let the larger sample visually swamp the smaller one.
    const binnedByRegime = regimes.map((r) => {
      const bins = binGen(r.data.pairwise_distances);
      const total = r.data.pairwise_distances.length;
      bins.forEach((b) => { b.share = b.length / total; });
      return { ...r, bins };
    });
    const maxShare = d3.max(binnedByRegime.flatMap((r) => r.bins.map((b) => b.share)));
    const y = d3.scaleLinear().domain([0, maxShare]).nice().range([innerH, 0]);

    const svg = d3.select(`#diversity-viz-${key}`).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%")
      .style("display", "block").style("height", "auto");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").attr("class", "gridline")
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
      .call((sel) => sel.select(".domain").remove());

    binnedByRegime.forEach((r) => {
      g.append("g").selectAll("rect")
        .data(r.bins)
        .join("rect")
        .attr("x", (d) => x(d.x0) + 1)
        .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
        .attr("y", (d) => y(d.share))
        .attr("height", (d) => innerH - y(d.share))
        .attr("fill", r.color)
        .attr("opacity", 0.72)
        .on("mousemove", (event, d) => {
          showTooltip(`<strong>${r.label}</strong><br>${d.x0.toFixed(0)}–${d.x1.toFixed(0)} bp different<br>${(d.share * 100).toFixed(1)}% of pairs (n=${d.length})`, event);
        })
        .on("mouseleave", hideTooltip);
    });

    const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8));
    xAxisG.selectAll("text").attr("class", "tick-label");
    g.append("text").attr("class", "axis-label")
      .attr("x", innerW / 2).attr("y", innerH + 30).attr("text-anchor", "middle")
      .text("pairwise Hamming distance (bp different, out of 1000)");

    const yAxisG = g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));
    yAxisG.selectAll("text").attr("class", "tick-label");
    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -34).attr("text-anchor", "middle")
      .text("share of that regime's own pairs");
  }

  // ---------------------------------------------------------------------
  // Samples per time bin, low vs high (share of own total)
  // ---------------------------------------------------------------------
  function renderTiming(key, text, data) {
    const regimes = [
      { key: "low", label: "Low sampling", color: cssVar("--series-low") },
      { key: "high", label: "High sampling", color: cssVar("--series-high") },
    ];
    document.getElementById(`timing-legend-${key}`).innerHTML = regimes.map((r) => `
      <span class="item"><span class="swatch" style="background:${r.color}"></span>${r.label}</span>`).join("");

    const edges = data.low.time_bin_edges;
    const nBins = REGIMES.n_bins;
    const bins = d3.range(nBins).map((i) => ({
      x0: edges[i], x1: edges[i + 1],
      low: data.low.time_bin_proportions[i],
      high: data.high.time_bin_proportions[i],
      lowCount: data.low.time_bin_counts[i],
      highCount: data.high.time_bin_counts[i],
    }));

    const margin = { top: 10, right: 20, bottom: 34, left: 46 };
    const width = 860, height = 260;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x0 = d3.scaleBand().domain(d3.range(nBins)).range([0, innerW]).padding(0.25);
    const x1 = d3.scaleBand().domain(["low", "high"]).range([0, x0.bandwidth()]).padding(0.12);
    const maxProp = d3.max(bins, (b) => Math.max(b.low, b.high));
    const y = d3.scaleLinear().domain([0, maxProp]).nice().range([innerH, 0]);

    const svg = d3.select(`#timing-viz-${key}`).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%")
      .style("display", "block").style("height", "auto");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").attr("class", "gridline")
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
      .call((sel) => sel.select(".domain").remove());

    const groupG = g.selectAll(".bin-group")
      .data(bins)
      .join("g")
      .attr("transform", (d, i) => `translate(${x0(i)},0)`);

    ["low", "high"].forEach((k) => {
      groupG.append("rect")
        .attr("x", x1(k))
        .attr("width", x1.bandwidth())
        .attr("y", (d) => y(d[k]))
        .attr("height", (d) => innerH - y(d[k]))
        .attr("fill", k === "low" ? cssVar("--series-low") : cssVar("--series-high"))
        .attr("opacity", 0.85)
        .on("mousemove", (event, d) => {
          const label = k === "low" ? "Low sampling" : "High sampling";
          const count = k === "low" ? d.lowCount : d.highCount;
          showTooltip(`<strong>${label}</strong><br>t ∈ [${d.x0.toFixed(1)}, ${d.x1.toFixed(1)})<br>${(d[k] * 100).toFixed(1)}% of samples (n=${count})`, event);
        })
        .on("mouseleave", hideTooltip);
    });

    const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickFormat((i) => bins[i].x0.toFixed(0)).tickSize(4));
    xAxisG.selectAll("text").attr("class", "tick-label");
    g.append("text").attr("class", "axis-label")
      .attr("x", innerW / 2).attr("y", innerH + 30).attr("text-anchor", "middle")
      .text("simulation time (bin start) — 0 = outbreak start, higher = closer to present");

    const yAxisG = g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));
    yAxisG.selectAll("text").attr("class", "tick-label");
    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -34).attr("text-anchor", "middle")
      .text("share of that regime's samples");
  }

  function renderExperiment(key) {
    const text = EXPERIMENT_TEXT[key];
    const data = REGIMES.experiments[key];
    const container = document.getElementById(`experiment-${key}`);
    container.innerHTML = experimentSectionHTML(key, text);

    renderSetupStats(key, text, data);
    renderOutbreakReach(key, text, data);
    renderDiversity(key, text, data);
    renderTiming(key, text, data);
  }

  renderExperiment("rate");
  renderExperiment("proportion");

  // ---------------------------------------------------------------------
  // Small demo tree with root-to-tip event slider (standalone intro):
  // a full tree panel (same underlying outbreak regardless of proportion)
  // plus a sampled-tree panel that rebuilds when the proportion toggle
  // changes, both driven by one shared time slider.
  // ---------------------------------------------------------------------
  (function renderDemoTree() {
    const eventColor = (event) => event === "birth" ? cssVar("--birth")
      : event === "sample" ? cssVar("--status-good") : cssVar("--status-critical");

    function flatten(root) {
      const nodes = [];
      const links = [];
      (function walk(n, parent) {
        nodes.push(n);
        if (parent) links.push({ parent, child: n });
        n.children.forEach((c) => walk(c, n));
      })(root, null);
      return { nodes, links };
    }

    const { nodes: fullNodes } = flatten(DEMO_TREE.full);
    const fullMinTime = d3.min(fullNodes, (n) => n.time);
    const fullMaxTime = d3.max(fullNodes, (n) => n.time);

    let proportion = "low"; // "low" | "high"
    const eventKey = () => proportion === "low" ? "eventLow" : "eventHigh";

    // -- shared controls --------------------------------------------------
    const slider = document.getElementById("tree-slider");
    const readout = document.getElementById("tree-t-readout");
    slider.min = fullMinTime;
    slider.max = fullMaxTime;
    slider.step = (fullMaxTime - fullMinTime) / 500;
    slider.value = fullMinTime;

    // -- full tree panel (layout built once; only colors/reveal change) --
    function buildFullPanel() {
      const { nodes, links } = flatten(DEMO_TREE.full);
      const maxY = d3.max(nodes, (n) => n.y);

      const margin = { top: 10, right: 90, bottom: 26, left: 16 };
      const width = 860;
      const rowH = 13;
      const height = Math.max(200, (maxY + 1) * rowH) + margin.top + margin.bottom;
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const x = d3.scaleLinear().domain([fullMinTime, fullMaxTime]).range([0, innerW]);
      const y = d3.scaleLinear().domain([0, maxY]).range([0, innerH]);

      const svg = d3.select("#tree-viz").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .style("display", "block")
        .style("height", "auto");
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const xAxisG = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerH + 8})`)
        .call(d3.axisBottom(x).ticks(6).tickSize(4));
      xAxisG.selectAll("text").attr("class", "tick-label");
      g.append("text").attr("class", "axis-label")
        .attr("x", innerW).attr("y", innerH + 26).attr("text-anchor", "end")
        .text("simulation time →");

      const branch = g.append("g").selectAll(".branch")
        .data(links)
        .join("path")
        .attr("class", "branch")
        .attr("fill", "none")
        .attr("stroke-width", 1.6)
        .attr("d", (d) => {
          const x0 = x(d.parent.time), x1 = x(d.child.time);
          const y0 = y(d.parent.y), y1 = y(d.child.y);
          return `M${x0},${y0} V${y1} H${x1}`;
        })
        .style("opacity", 0.12);

      const nodeSel = g.append("g").selectAll(".node")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("cx", (d) => x(d.time))
        .attr("cy", (d) => y(d.y))
        .style("cursor", "pointer")
        .on("mousemove", (event, d) => {
          const ev = d[eventKey()];
          const label = ev === "birth" ? "Birth (transmission)" : ev === "sample" ? "Sampled" : "Died (unsampled)";
          showTooltip(`<strong>${label}</strong><br>t = ${d.time.toFixed(2)}${d.label ? `<br>${d.label}` : ""}`, event);
        })
        .on("mouseleave", hideTooltip);

      const ring = g.append("circle")
        .attr("r", 8).attr("fill", "none").attr("stroke-width", 2)
        .style("opacity", 0);

      const sortedByTime = nodes.slice().sort((a, b) => a.time - b.time);
      const logEl = document.getElementById("tree-event-log");

      function recolor() {
        const key = eventKey();
        branch.attr("stroke", (d) => eventColor(d.child[key]));
        nodeSel.attr("fill", (d) => eventColor(d[key]))
          .attr("r", (d) => d[key] === "birth" ? 2.6 : 4.2);
      }

      function update(t) {
        const key = eventKey();
        readout.textContent = `t = ${t.toFixed(2)}`;
        branch.style("opacity", (d) => d.child.time <= t ? 0.9 : 0.12);
        nodeSel.style("opacity", (d) => d.time <= t ? 1 : 0.12)
          .attr("r", (d) => {
            const big = d.time <= t;
            if (d[key] === "birth") return big ? 3 : 2.6;
            return big ? 5 : 4.2;
          });

        let latest = null;
        for (const n of sortedByTime) { if (n.time <= t) latest = n; else break; }
        if (latest) {
          ring.attr("cx", x(latest.time)).attr("cy", y(latest.y))
            .attr("stroke", eventColor(latest[key]))
            .style("opacity", 1);
          const ev = latest[key];
          const label = ev === "birth" ? "Birth / transmission" : ev === "sample" ? "Sampling event" : "Death (unsampled)";
          const tagClass = ev === "birth" ? "birth" : ev === "sample" ? "sample" : "dead";
          const revealed = sortedByTime.filter((n) => n.time <= t);
          const counts = { birth: 0, sample: 0, dead: 0 };
          revealed.forEach((n) => { counts[n[key]]++; });
          logEl.innerHTML = `<span class="tag ${tagClass}">${label}</span> at t = ${latest.time.toFixed(2)}`
            + ` &nbsp;&middot;&nbsp; so far: ${counts.birth} birth${counts.birth === 1 ? "" : "s"}, `
            + `${counts.dead} death${counts.dead === 1 ? "" : "s"}, ${counts.sample} sampled`;
        } else {
          ring.style("opacity", 0);
          logEl.textContent = "Move the slider to begin.";
        }
      }

      recolor();
      return { update, recolor };
    }

    // -- sampled tree panel (fully rebuilt whenever proportion toggles) --
    let sampledPanel = null;
    function buildSampledPanel() {
      d3.select("#sampled-tree-viz").selectAll("*").remove();
      const treeData = proportion === "low" ? DEMO_TREE.sampledLow : DEMO_TREE.sampledHigh;
      const { nodes, links } = flatten(treeData);
      const maxY = d3.max(nodes, (n) => n.y) || 0;

      const margin = { top: 10, right: 90, bottom: 26, left: 16 };
      const width = 860;
      const rowH = 20;
      const height = Math.max(90, (maxY + 1) * rowH) + margin.top + margin.bottom;
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      // shares the full tree's time domain so the two panels line up
      const x = d3.scaleLinear().domain([fullMinTime, fullMaxTime]).range([0, innerW]);
      const y = d3.scaleLinear().domain([0, maxY]).range([0, innerH]);

      const svg = d3.select("#sampled-tree-viz").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .style("display", "block")
        .style("height", "auto");
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const xAxisG = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerH + 8})`)
        .call(d3.axisBottom(x).ticks(6).tickSize(4));
      xAxisG.selectAll("text").attr("class", "tick-label");
      g.append("text").attr("class", "axis-label")
        .attr("x", innerW).attr("y", innerH + 26).attr("text-anchor", "end")
        .text("simulation time →");

      const branch = g.append("g").selectAll(".branch")
        .data(links)
        .join("path")
        .attr("class", "branch")
        .attr("fill", "none")
        .attr("stroke", cssVar("--status-good"))
        .attr("stroke-width", 1.6)
        .attr("d", (d) => {
          const x0 = x(d.parent.time), x1 = x(d.child.time);
          const y0 = y(d.parent.y), y1 = y(d.child.y);
          return `M${x0},${y0} V${y1} H${x1}`;
        })
        .style("opacity", 0.12);

      const nodeSel = g.append("g").selectAll(".node")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("cx", (d) => x(d.time))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => d.event === "birth" ? 2.6 : 4.2)
        .attr("fill", (d) => d.event === "birth" ? cssVar("--birth") : cssVar("--status-good"))
        .style("cursor", "pointer")
        .on("mousemove", (event, d) => {
          const label = d.event === "birth" ? "Shared ancestor (coalescent point)" : "Sampled sequence";
          showTooltip(`<strong>${label}</strong><br>t = ${d.time.toFixed(2)}${d.label ? `<br>${d.label}` : ""}`, event);
        })
        .on("mouseleave", hideTooltip);

      const ring = g.append("circle")
        .attr("r", 8).attr("fill", "none").attr("stroke-width", 2).attr("stroke", cssVar("--status-good"))
        .style("opacity", 0);

      const sortedByTime = nodes.slice().sort((a, b) => a.time - b.time);
      const nSampled = nodes.filter((n) => n.event === "sample").length;
      const logEl = document.getElementById("sampled-tree-event-log");

      function update(t) {
        branch.style("opacity", (d) => d.child.time <= t ? 0.9 : 0.12);
        nodeSel.style("opacity", (d) => d.time <= t ? 1 : 0.12)
          .attr("r", (d) => {
            const big = d.time <= t;
            if (d.event === "birth") return big ? 3 : 2.6;
            return big ? 5 : 4.2;
          });

        let latest = null;
        for (const n of sortedByTime) { if (n.time <= t) latest = n; else break; }
        if (latest) {
          ring.attr("cx", x(latest.time)).attr("cy", y(latest.y)).style("opacity", 1);
          const revealedSamples = sortedByTime.filter((n) => n.time <= t && n.event === "sample").length;
          const label = latest.event === "birth" ? "Shared ancestor" : "Sampled sequence";
          logEl.innerHTML = `<span class="tag sample">${label}</span> at t = ${latest.time.toFixed(2)}`
            + ` &nbsp;&middot;&nbsp; ${revealedSamples} of ${nSampled} sampled sequences revealed so far`;
        } else {
          ring.style("opacity", 0);
          logEl.textContent = "No sequences sampled yet.";
        }
      }

      return { update };
    }

    const fullPanel = buildFullPanel();
    sampledPanel = buildSampledPanel();

    function update(t) {
      fullPanel.update(t);
      sampledPanel.update(t);
    }

    update(fullMinTime);
    slider.addEventListener("input", () => update(+slider.value));

    // -- proportion toggle --------------------------------------------------
    document.querySelectorAll("#proportion-toggle .toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.proportion === proportion) return;
        proportion = btn.dataset.proportion;
        document.querySelectorAll("#proportion-toggle .toggle-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        fullPanel.recolor();
        sampledPanel = buildSampledPanel();
        update(+slider.value);
      });
    });

    // -- play button (drives both panels) -----------------------------------
    let playing = false, rafId = null;
    const playBtn = document.getElementById("tree-play");
    playBtn.addEventListener("click", () => {
      playing = !playing;
      playBtn.innerHTML = playing ? "&#10074;&#10074; Pause" : "&#9654; Play";
      if (playing) {
        if (+slider.value >= fullMaxTime) slider.value = fullMinTime;
        const speed = (fullMaxTime - fullMinTime) / 6000; // ~6s full sweep
        let last = performance.now();
        const step = (now) => {
          if (!playing) return;
          const dt = now - last; last = now;
          let v = +slider.value + speed * dt;
          if (v >= fullMaxTime) { v = fullMaxTime; playing = false; playBtn.innerHTML = "&#9654; Play"; }
          slider.value = v;
          update(v);
          if (playing) rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      } else {
        cancelAnimationFrame(rafId);
      }
    });
  })();
})();
