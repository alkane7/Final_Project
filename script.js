const margin = { top: 50, right: 30, bottom: 50, left: 60 },
      width = 650 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;


const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

let dataByPerson = new Map();

d3.csv("dexcom_with_food_updated.csv").then(rawData => {
    const data = rawData.map(d => {
      const rawTime = d["Timestamp (YYYY-MM-DDThh:mm:ss)"];
      const ts = new Date(rawTime.replace(" ", "T"));  // 修复非 ISO 格式

      return {
        ...d,
        person: d.person.toString().padStart(3, '0'),
        timestamp: ts,
        date: d3.timeFormat("%Y-%m-%d")(ts)
      };
    });

    dataByPerson = d3.group(data, d => d.person);

    const personSelect = d3.select("#person-select");
    const dateSelect = d3.select("#date-select");

    personSelect.selectAll("option")
      .data(Array.from(dataByPerson.keys()))
      .join("option")
      .attr("value", d => d)
      .text(d => d);

    personSelect.on("change", updateDateOptions);
    dateSelect.on("change", drawChart);

    updateDateOptions();

    function updateDateOptions() {
      const selectedPerson = personSelect.property("value");
      const personData = dataByPerson.get(selectedPerson);
      if (!personData) return;

      const dates = Array.from(d3.group(personData, d => d.date).keys());

      dateSelect.selectAll("option")
        .data(dates)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      drawChart();
    }

    const tooltip = d3.select("#tooltip");
    const timeFormat = d3.timeFormat("%-I:%M %p");

    function drawChart() {
        const selectedPerson = personSelect.property("value");
        const selectedDate = dateSelect.property("value");

        const personData = dataByPerson.get(selectedPerson);
        if (!personData) return;

        const filtered = personData
          .filter(d => d.date === selectedDate)
          .sort((a, b) => a.timestamp - b.timestamp);
        if (filtered.length === 0) return;

        svg.selectAll("*").remove();

        let x = d3.scaleTime().domain(d3.extent(filtered, d => d.timestamp)).range([0, width]);
        let y = d3.scaleLinear()
          .domain([
            d3.min(filtered, d => +d["Glucose Value (mg/dL)"]) - 10,
            d3.max(filtered, d => +d["Glucose Value (mg/dL)"]) + 10
          ])
          .range([height, 0]);

        const xAxis = svg.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(x).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%H:%M")));

        const yAxis = svg.append("g").call(d3.axisLeft(y));

        svg.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -50)
          .attr("x", -height / 2)
          .attr("dy", "1em")
          .style("text-anchor", "middle")
          .style("font-size", "14px")
          .text("Glucose Value (mg/dL)");

        svg.append("text")
          .attr("x", width / 2)
          .attr("y", height + 40)
          .style("text-anchor", "middle")
          .style("font-size", "14px")
          .text("Time of Day");

        svg.append("text")
          .attr("x", width / 2)
          .attr("y", -20)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .text(`Person ${selectedPerson} - ${selectedDate}`);


        let brush = d3.brushX()
          .extent([[0, 0], [width, height]])
          .on("end", function (event) {
            if (!event.selection) return;

            const [x0, x1] = event.selection.map(x.invert);
            const zoomed = filtered.filter(d => d.timestamp >= x0 && d.timestamp <= x1);

            x = d3.scaleTime().domain([x0, x1]).range([0, width]);
            y = d3.scaleLinear()
              .domain([
                d3.min(zoomed, d => +d["Glucose Value (mg/dL)"]) - 10,
                d3.max(zoomed, d => +d["Glucose Value (mg/dL)"]) + 10
              ])
              .range([height, 0]);

            svg.selectAll("path").remove();
            svg.selectAll("circle").remove();
            xAxis.call(d3.axisBottom(x).ticks(d3.timeHour.every(1)).tickFormat(d3.timeFormat("%H:%M")));
            yAxis.call(d3.axisLeft(y));

            drawAndBind(zoomed, x, y);
            svg.select(".brush").call(brush.move, null);
          });

        svg.append("g").attr("class", "brush").call(brush);
        drawAndBind(filtered, x, y);

        d3.select("#reset-view").on("click", () => {
          x = d3.scaleTime().domain(d3.extent(filtered, d => d.timestamp)).range([0, width]);
          y = d3.scaleLinear()
            .domain([
              d3.min(filtered, d => +d["Glucose Value (mg/dL)"]) - 10,
              d3.max(filtered, d => +d["Glucose Value (mg/dL)"]) + 10
            ])
            .range([height, 0]);

          svg.selectAll("path").remove();
          svg.selectAll("circle").remove();
          svg.selectAll(".brush").remove();

          xAxis.call(d3.axisBottom(x).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%H:%M")));
          yAxis.call(d3.axisLeft(y));

          brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on("end", function (event) {
              if (!event.selection) return;

              const [x0, x1] = event.selection.map(x.invert);
              const zoomed = filtered.filter(d => d.timestamp >= x0 && d.timestamp <= x1);

              x = d3.scaleTime().domain([x0, x1]).range([0, width]);
              y = d3.scaleLinear()
                .domain([
                  d3.min(zoomed, d => +d["Glucose Value (mg/dL)"]) - 10,
                  d3.max(zoomed, d => +d["Glucose Value (mg/dL)"]) + 10
                ])
                .range([height, 0]);

              svg.selectAll("path").remove();
              svg.selectAll("circle").remove();
              xAxis.call(d3.axisBottom(x).ticks(d3.timeHour.every(1)).tickFormat(d3.timeFormat("%H:%M")));
              yAxis.call(d3.axisLeft(y));
              drawAndBind(zoomed, x, y);

              svg.select(".brush").call(brush.move, null);
            });

          svg.append("g").attr("class", "brush").call(brush);
          drawAndBind(filtered, x, y);
        });
    }

  // ✅ 分离折线绘制 + tooltip 绑定逻辑
    function drawAndBind(data, x, y) {
        const segments = [];
        let currentSegment = [data[0]];
        for (let i = 1; i < data.length; i++) {
          const prev = data[i - 1];
          const curr = data[i];
          const gapMinutes = (curr.timestamp - prev.timestamp) / (1000 * 60);
          if (gapMinutes < 60) {
            currentSegment.push(curr);
          } else {
            segments.push(currentSegment);
            currentSegment = [curr];
          }
        }
        if (currentSegment.length > 0) segments.push(currentSegment);

        const lineGenerator = d3.line()
          .x(d => x(d.timestamp))
          .y(d => y(+d["Glucose Value (mg/dL)"]));

        segments.forEach(segment => {
          if (segment.length >= 2) {
            svg.append("path")
              .datum(segment)
              .attr("fill", "none")
              .attr("stroke", "#007acc")
              .attr("stroke-width", 2)
              .attr("d", lineGenerator);
          }
        });

        svg.selectAll("circle")
          .data(data)
          .join("circle")
          .attr("cx", d => x(d.timestamp))
          .attr("cy", d => y(+d["Glucose Value (mg/dL)"]))
          .attr("r", 4)
          .attr("fill", d => d.eat_flag === "True" || d.eat_flag === true ? "red" : "#007acc");

        // ✅ 独立统一 tooltip 绑定
        svg.selectAll("circle")
          .on("mouseover", function (event, d) {
            const hour = d.timestamp.getHours();
            const isDay = hour >= 6 && hour < 18;
            const iconPath = isDay ? "image/sun.png" : "image/moon.png";
          
            let html = `
              <div style="position: relative;">
                <img src="${iconPath}" width="20" style="position: absolute; top: 0; right: 0;" />
                <div><strong>Time:</strong> ${timeFormat(d.timestamp)}</div>
                <div><strong>Glucose:</strong> ${d["Glucose Value (mg/dL)"]} mg/dL</div>
            `;
          
            if (d.eat_flag === "True" || d.eat_flag === true) {
              html += `<div><strong>Food:</strong> ${d.logged_food || ""}</div>`;
              html += `<div><strong>Amount:</strong> ${d.amount || ""}</div>`;
              html += `<div><strong>Searched:</strong> ${d.searched_food || ""}</div>`;
              html += `<div><strong>Calorie:</strong> ${d.calorie || ""} kcal</div>`;
              html += `<div><strong>Carb:</strong> ${d.total_carb || ""} g</div>`;
              html += `<div><strong>Fiber:</strong> ${d.dietary_fiber || ""} g</div>`;
              html += `<div><strong>Sugar:</strong> ${d.sugar || ""} g</div>`;
              html += `<div><strong>Protein:</strong> ${d.protein || ""} g</div>`;
              html += `<div><strong>Fat:</strong> ${d.total_fat || ""} g</div>`;
            }
          
            html += `</div>`;
          
            tooltip.html(html)
              // .style("left", (event.pageX + 12) + "px")
              // .style("top", (event.pageY - 28) + "px")
              // .classed("show", true);

            requestAnimationFrame(() => {
              const tooltipNode = tooltip.node();
              const tooltipWidth = tooltipNode.offsetWidth;
              const tooltipHeight = tooltipNode.offsetHeight;
          
              const padding = 12; // 与鼠标距离
              let x = event.pageX + padding;
              let y = event.pageY + padding;
          
              // ⛔️ 屏幕右边界：往左偏移
              if (x + tooltipWidth > window.innerWidth) {
                x = event.pageX - tooltipWidth - padding;
              }
          
              // ⛔️ 屏幕底部边界：往上偏移
              if (y + tooltipHeight > window.innerHeight) {
                y = event.pageY - tooltipHeight - padding;
              }
          
              tooltip
                .style("left", `${x}px`)
                .style("top", `${y}px`)
                .classed("show", true);
            });
          })
          .on("mouseout", () => {
            tooltip.classed("show", false);
          });
    }


  
  
  
});
