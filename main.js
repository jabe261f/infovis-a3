var d3;

// Waiting until document has loaded
window.onload = () => {

  // Loading the dataset
  fetch('data/football.json')
    .then((response) => response.json())
    .then((data) => {

      // Torwarts rausfiltern, da diese die Daten sehr verfälschen
      const outfieldPlayers = data.nodes.filter(s => s.keeper_save_total === undefined);

      const pcpplot = createPCPlot(outfieldPlayers);
      const scatterPlot = createScatterPlot(outfieldPlayers);

      // Synchronisation 1: PC-Plot zu Scatterplot
      pcpplot.addEventListener("input", () => {
        const selectedPlayers = pcpplot.value;
        const activeIds = selectedPlayers.length > 0 ? new Set(selectedPlayers.map(d => d.id)) : null;
        
        d3.select(scatterPlot).selectAll("circle")
          .classed("hidden", d => activeIds ? !activeIds.has(d.id) : false);
      });

      // Synchronisation 2: Scatterplot zu PC-Plot
      scatterPlot.addEventListener("input", () => {
        const selectedPlayers = scatterPlot.value;
        const activeIds = selectedPlayers.length > 0 ? new Set(selectedPlayers.map(d => d.id)) : null;
        
        const deselectedColor = "#ddd";
        const keyz = "mins_played";
        const color = pcpplot.colorScale; 

        d3.select(pcpplot).selectAll("path")
          .each(function(d) {
            const element = d3.select(this);
            const isActive = !activeIds || activeIds.has(d.id);
            
            if (!activeIds) {
              // Standardzustand (kein aktiver Brush)
              element
                .style("stroke", color(d[keyz]))
                .style("stroke-opacity", 0.4)
                .style("stroke-width", 1.5);
            } else if (isActive) {
              // Getroffen im Scatterplot
              element
                .style("stroke", color(d[keyz]))
                .style("stroke-opacity", 1.0)
                .style("stroke-width", 3.0)
                .raise();
            } else {
              // Nicht getroffen
              element
                .style("stroke", deselectedColor)
                .style("stroke-opacity", 0.02)
                .style("stroke-width", 1.0);
            }
          });
      });

      document.getElementById("chart").appendChild(pcpplot);
      document.getElementById("chart2").appendChild(scatterPlot);

    });
};

function createPCPlot(originalNodes) {
  const nodes = originalNodes.map(d => ({...d}));

  const keys = Array.from(
    new Set(nodes.flatMap(d => Object.keys(d).filter(k => typeof d[k] === "number" && k !== "id")))
  );
  const keyz = "mins_played";

  nodes.forEach(spieler => {
    keys.forEach(key => {
      if (spieler[key] === undefined) spieler[key] = 0;
    });
  });

  const width = keys.length * 100;
  const height = 500;
  const marginTop = 40;
  const marginRight = 50;
  const marginBottom = 30;
  const marginLeft = 50;

  const x = d3.scalePoint(keys, [marginLeft, width - marginRight]);
  const y = new Map(Array.from(keys, key => [
    key, 
    d3.scaleLinear(d3.extent(nodes, d => d[key]), [height - marginBottom, marginTop])
  ]));

  const color = d3.scaleSequential(y.get(keyz).domain(), t => d3.interpolateBrBG(1 - t));

  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", `width: ${width}px; height: ${height}px; font-family: sans-serif;`);

  const line = d3.line()
    .defined(([, value]) => value != null)
    .x(([key]) => x(key))
    .y(([key, value]) => y.get(key)(value));

  const path = svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.4)
    .selectAll("path")
    .data(nodes.slice().sort((a, b) => d3.ascending(a[keyz], b[keyz])))
    .join("path")
      .attr("stroke", d => color(d[keyz]))
      .attr("d", d => line(d3.cross(keys, [d], (key, d) => [key, d[key]])))
    .call(path => path.append("title").text(d => d.label));

  const axes = svg.append("g")
    .selectAll("g")
    .data(keys)
    .join("g")
      .attr("transform", d => `translate(${x(d)},0)`)
      .each(function(d) { 
        d3.select(this).call(d3.axisLeft(y.get(d)).tickSize(-5).tickPadding(8)); 
      })
      .call(g => g.append("text")
        .attr("x", 0)
        .attr("y", marginTop - 15)
        .attr("text-anchor", "middle")
        .attr("fill", "#2c3e50")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .text(d => d))
      .call(g => g.selectAll("text")
        .clone(true).lower()
        .attr("fill", "none")
        .attr("stroke-width", 5)
        .attr("stroke-linejoin", "round")
        .attr("stroke", "white"));

  const deselectedColor = "#ddd";
  const brushWidth = 24;
  const brushY = d3.brushY()
      .extent([
        [-(brushWidth / 2), marginTop],
        [brushWidth / 2, height - marginBottom]
      ])
      .on("start brush end", brushed);

  axes.call(brushY);

  const selections = new Map();

  function brushed({selection}, key) {
    if (selection === null) selections.delete(key);
    else selections.set(key, selection.map(y.get(key).invert)); 
    
    const activeFilters = Array.from(selections.entries());
    const hasActiveFilter = activeFilters.length > 0;
    const selected = [];
    
    path.each(function(d) {
      const active = activeFilters.every(([fKey, [max, min]]) => d[fKey] >= min && d[fKey] <= max);
      const element = d3.select(this);
      
      if (!hasActiveFilter) {
        element.style("stroke", color(d[keyz])).style("stroke-opacity", 0.4).style("stroke-width", 1.5);
      } else if (active) {
        element.style("stroke", color(d[keyz])).style("stroke-opacity", 1.0).style("stroke-width", 3.0).raise();
        selected.push(d);
      } else {
        element.style("stroke", deselectedColor).style("stroke-opacity", 0.02).style("stroke-width", 1.0);
      }
    });
    svg.property("value", selected).dispatch("input");
  }

  const node = svg.node();
  node.colorScale = color; 
  return node;
}

function createScatterPlot(originalNodes) {
  const nodes = originalNodes.map(d => ({...d}));
  const columns = ["appearance", "mins_played", "dribble_lost", "final_third"];

  const width = 928;
  const height = width;
  const padding = 28;
  const size = (width - (columns.length + 1) * padding) / columns.length + padding;

  nodes.forEach(spieler => {
    columns.forEach(key => {
      if (spieler[key] === undefined) spieler[key] = 0;
    });
  });

  const x = columns.map(c => d3.scaleLinear()
      .domain(d3.extent(nodes, d => d[c]))
      .rangeRound([padding / 2, size - padding / 2]))

  const y = x.map(s => s.copy().range([size - padding / 2, padding / 2]));

  const color = d3.scaleSequential()
      .domain(d3.extent(nodes, d => d["mins_played"]))
      .interpolator(t => d3.interpolateBrBG(1 - t));

  const axisx = d3.axisBottom().ticks(5).tickSize(size * columns.length).tickPadding(8);
  const xAxis = g => g.selectAll("g").data(x).join("g")
      .attr("transform", (d, i) => `translate(${i * size},0)`)
      .each(function(d) { return d3.select(this).call(axisx.scale(d)); })
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e9ecef"))
      .call(g => g.selectAll(".tick text").attr("fill", "#868e96").style("font-size", "10px"));

  const axisy = d3.axisLeft().ticks(5).tickSize(-size * columns.length).tickPadding(8);
  const yAxis = g => g.selectAll("g").data(y).join("g")
      .attr("transform", (d, i) => `translate(0,${(columns.length - 1 - i) * size})`)
      .each(function(d) { return d3.select(this).call(axisy.scale(d)); })
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e9ecef"))
      .call(g => g.selectAll(".tick text").attr("fill", "#868e96").style("font-size", "10px"));
  
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-padding, 0, width, height])
      .attr("style", "font-family: sans-serif;");

  svg.append("style")
      .text(`circle.hidden { fill: #ccc !important; fill-opacity: 0.15 !important; r: 2px !important; }`);

  svg.append("g").call(xAxis);
  svg.append("g").call(yAxis);

  const cell = svg.append("g")
    .selectAll("g")
    .data(d3.cross(d3.range(columns.length), d3.range(columns.length)))
    .join("g")
      .attr("transform", ([i, j]) => `translate(${i * size},${(columns.length - 1 - j) * size})`);

  cell.append("rect")
      .attr("fill", "none")
      .attr("stroke", "#dee2e6")
      .attr("x", padding / 2 + 0.5)
      .attr("y", padding / 2 + 0.5)
      .attr("width", size - padding)
      .attr("height", size - padding);

  cell.each(function([i, j]) {
    d3.select(this).selectAll("circle")
      .data(nodes.filter(d => !isNaN(d[columns[i]]) && !isNaN(d[columns[j]])))
      .join("circle")
        .attr("cx", d => x[i](d[columns[i]]))
        .attr("cy", d => y[j](d[columns[j]]));
  });

  const circle = cell.selectAll("circle")
      .attr("r", 4)
      .attr("fill-opacity", 0.75)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("fill", d => color(d["mins_played"]));

  circle.append("title").text(d => d.label);

  cell.call(brush, circle, svg, {padding, size, x, y, columns, nodes});

  svg.append("g")
      .style("font", "bold 12px sans-serif")
      .style("pointer-events", "none")
    .selectAll("text")
    .data(columns)
    .join("text")
      .attr("transform", (d, i) => `translate(${i * size}, ${(columns.length - 1 - i) * size})`)
      .attr("x", padding)
      .attr("y", padding + 5)
      .attr("dy", ".71em")
      .attr("fill", "#212529")
      .text(d => d);

  return svg.node();
}

function brush(cell, circle, svg, {padding, size, x, y, columns, nodes}) {
  const brushObj = d3.brush()
      .extent([[padding / 2, padding / 2], [size - padding / 2, size - padding / 2]])
      .on("start", brushstarted)
      .on("brush", brushed)
      .on("end", brushended);

  cell.call(brushObj);
  let brushCell;

  function brushstarted() {
    if (brushCell !== this) {
      d3.select(brushCell).call(brushObj.move, null);
      brushCell = this;
    }
  }

  function brushed({selection}, [i, j]) {
    let selected = [];
    if (selection) {
      const [[x0, y0], [x1, y1]] = selection; 
      circle.classed("hidden",
        d => x0 > x[i](d[columns[i]])
          || x1 < x[i](d[columns[i]])
          || y0 > y[j](d[columns[j]])
          || y1 < y[j](d[columns[j]]));
          
      selected = nodes.filter(
        d => x0 < x[i](d[columns[i]])
          && x1 > x[i](d[columns[i]])
          && y0 < y[j](d[columns[j]])
          && y1 > y[j](d[columns[j]]));
    }
    svg.property("value", selected).dispatch("input");
  }

  function brushended({selection}) {
    if (selection) return;
    svg.property("value", []).dispatch("input");
    circle.classed("hidden", false);
  }
}