'use strict';

/* global d3 */

const versionColor = d3.scaleOrdinal(d3.schemeCategory10);
versionColor(0); // Skip blue -- too similar to link color.

const formatMillisecond = d3.timeFormat(".%L");
const formatSecond = d3.timeFormat(":%S");

function formatSample(sample) {
  return (d3.timeSecond(sample) < sample ? formatMillisecond : formatSecond)(sample);
}

class Plot extends React.Component {
    render() {
        return <svg width="100%" ref={node => this.node = node}></svg>;
    }

    componentDidMount() {
        this.plot();
    }

    componentDidUpdate() {
        this.plot();
    }
}

class DensityPlot extends Plot {
    plot() {
        function kernelDensityEstimator(kernel, X) {
            return function(V) {
                // https://en.wikipedia.org/wiki/Kernel_density_estimation#A_rule-of-thumb_bandwidth_estimator
                const bandwidth = 1.06 * d3.deviation(V) * Math.pow(V.length, -0.2);
                return X.map(function(x) {
                    return [x, d3.mean(V, function(v) { return kernel((x - v) / bandwidth); }) / bandwidth];
                });
            };
        }

        function kernelEpanechnikov(v) {
            return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) : 0;
        }

        const margin = {top: 20, right: 20, bottom: 30, left: 40},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        const x = d3.scaleLinear()
            .domain([0, d3.max(Array.prototype.concat.apply([], this.props.versions.map(version => version.samples)))])
            .range([0, width])
            .nice();

        const density = kernelDensityEstimator(kernelEpanechnikov, x.ticks(50));
        const versions = this.props.versions.map(version => ({
            name: version.name,
            density: version.samples.length ? density(version.samples) : undefined
        }));
        const yMax = d3.max(versions, version =>
            d3.max(version.density || [], d => d[1]));

        const y = d3.scaleLinear()
            .domain([0, yMax])
            .range([height, 0]);

        const svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(formatSample))
            .append("text")
            .attr("fill", "#000")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Time");

        enter
            .append("g")
            .call(d3.axisLeft(y).ticks(4, "%"));

        const version = svg.selectAll(".density")
            .data(versions);

        version.enter().append("path")
            .attr("class", "density")
            .attr("fill", "none")
            .attr("stroke", version => versionColor(version.name))
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .merge(version)
            .attr("d", version => version.density ? d3.line()
                .curve(d3.curveBasis)
                .x(d => x(d[0]))
                .y(d => y(d[1]))(version.density) : "");
    }
}

function regression(samples) {
    const result = [];
    for (let i = 0, n = 1; i + n < samples.length; i += n, n++) {
        result.push([n, samples.slice(i, i + n).reduce(((sum, sample) => sum + sample), 0)]);
    }
    return result;
}

class RegressionPlot extends Plot {
    plot() {
        const margin = {top: 20, right: 20, bottom: 30, left: 40},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        const versions = this.props.versions.filter(version => version.regression);

        const x = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[0])))])
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[1])))])
            .range([height, 0])
            .nice();

        const line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]));

        const svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .append("text")
            .attr("fill", "#000")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Iterations");

        enter
            .append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y).ticks(4).tickFormat(formatSample))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time");

        const version = svg.selectAll(".version")
            .data(versions);

        // scatter plot
        const versionEnter = version.enter().append("g")
            .attr("class", "version")
            .style("fill", version => versionColor(version.name))
            .style("fill-opacity", 0.7);

        versionEnter.merge(version).selectAll("circle")
            .data(version => version.regression.data)
            .enter().append("circle")
            .attr("r", 2)
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]));

        // regression line
        versionEnter.append('path')
            .attr('stroke', version => versionColor(version.name))
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.5)
            .attr('class', 'regression-line');

        versionEnter.merge(version).selectAll('.regression-line')
            .attr('d', version => line(version.regression.data.map(d => [
                d[0],
                d[0] * version.regression.slope + version.regression.intercept
            ])));
    }
}

class BenchmarkRow extends React.Component {
    render() {
        const ended = this.props.versions.find(version => version.status === 'ended');
        return (
            <div className="col12 clearfix space-bottom">
                <h2 className="col4"><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></h2>
                <div className="col8">
                    {this.props.versions.map(version =>
                        <div key={version.name} className="col6">
                            <h3 style={{color: versionColor(version.name)}}>{version.name}</h3>
                            <p className={version.status === 'waiting' ? 'quiet' : ''}>
                                {version.status === 'running' ? 'Running...' : version.message}
                            </p>
                        </div>
                    )}
                    {ended && <DensityPlot versions={this.props.versions}/>}
                    {ended && <RegressionPlot versions={this.props.versions}/>}
                </div>
            </div>
        );
    }

    reload() {
        location.reload();
    }
}

class BenchmarksTable extends React.Component {
    render() {
        return (
            <div style={{width: 960, margin: '2em auto'}}>
                <h1 className="space-bottom1">Mapbox GL JS Benchmarks</h1>
                {this.props.benchmarks.map(benchmark => <BenchmarkRow key={benchmark.name} {...benchmark}/>)}
            </div>
        );
    }
}

const versions = window.mapboxglVersions;
const benchmarks = [];
const filter = window.location.hash.substr(1);

let finished = false;
let promise = Promise.resolve();

for (const name in window.mapboxglBenchmarks) {
    if (filter && name !== filter)
        continue;

    const benchmark = { name, versions: [] };
    benchmarks.push(benchmark);

    for (const ver in window.mapboxglBenchmarks[name]) {
        const version = {
            name: ver,
            status: 'waiting',
            logs: [],
            samples: []
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(samples => {
                    version.status = 'ended';
                    version.message = `${d3.mean(samples).toFixed(0)}ms`;
                    version.samples = samples;
                    version.regression = leastSquaresRegression(regression(samples));
                    version.message = `${version.regression.slope.toFixed(0)}ms`;
                    update();
                })
                .catch(error => {
                    version.status = 'errored';
                    version.message = error.message;
                    update();
                });
        });
    }
}

promise = promise.then(() => {
    finished = true;
    update();
})

function update() {
    ReactDOM.render(
        <BenchmarksTable versions={versions} benchmarks={benchmarks} finished={finished}/>,
        document.getElementById('benchmarks')
    );
}

function leastSquaresRegression(data) {
    const meanX = d3.sum(data, d => d[0]) / data.length;
    const meanY = d3.sum(data, d => d[1]) / data.length;
    const varianceX = d3.variance(data, d => d[0]);
    const sdX = Math.sqrt(varianceX);
    const sdY = d3.deviation(data, d => d[1]);
    const covariance = d3.sum(data, ([x, y]) =>
        (x - meanX) * (y - meanY)
    ) / (data.length - 1);

    const correlation = covariance / sdX / sdY;
    const slope = covariance / varianceX;
    const intercept = meanY - slope * meanX;

    return { correlation, slope, intercept, data };
}
