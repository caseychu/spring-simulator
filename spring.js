window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function (fn) {
	setTimeout(function () {
		fn(Date.now());
	}, 16);
};

function Renderer(canvas, width, height, render) {
	this.canvas = canvas;
	canvas.width = width;
	canvas.height = height;
	
	var context = this.context = canvas.getContext('2d');
	this.render = function () {
		context.clearRect(0, 0, width, height);
		render.apply(context, arguments);
	};
	this.setDimensions = function (w, h) {
		canvas.width = width = w;
		canvas.height = height = h;
	};
}

function control(id, value, inv, callback) {
	var control = document.getElementById(id).querySelector('input');
	var val = document.getElementById(id).querySelector('output');

	control.onchange = function () {
		val.innerHTML = value(+this.value).toFixed(2);
		return callback(value(+this.value));
	};
	control.onchange();
	
	return function (n) {
		val.innerHTML = n.toFixed ? n.toFixed(2) : n;
		control.value = inv(n);
		return n;
	};
}

window.onload = function () {
	var sqrt = Math.sqrt;
	var exp = Math.exp;
	var log = Math.log;
	var exp0 = function (x) { return x < -4.5 ? 0 : exp(x); };
	var id = function (x) { return x; };
	var sq = function (x) { return x * x; };
	var sin = Math.sin;
	var cos = Math.cos;
	var PI = Math.PI;
	var disabled = function (x) { return false; };
	
	var WIDTH = window.innerWidth;
	var HEIGHT = window.innerHeight;
	var BLOCK_WIDTH = 220;
	var BLOCK_HEIGHT = 150;
	var BLOCK_Y = HEIGHT * 4 / 5;
	var SPRING_WIDTH = 80;
	var STRING_POS = (WIDTH - 400 - BLOCK_WIDTH) * 0.75;
	var SPRING_BUFFER_HEIGHT = 25;
	var SPRING_EQUIL_Y = (HEIGHT - BLOCK_HEIGHT) / 2;
	var GRAPH_PERIOD = 20000;
	var TICK_HEIGHT = 15;
	var PIXELS_PER_MS = WIDTH / GRAPH_PERIOD;
	var LORENTZIAN_MAX = 13;
	var LORENTZIAN_WIDTH = document.querySelector('input').offsetWidth - 10;
	var LORENTZIAN_HEIGHT = 80;
	
	window.onresize = function () {
		HEIGHT = window.innerHeight;
		spring.setDimensions(WIDTH, HEIGHT);
		graph.setDimensions(WIDTH, HEIGHT);
	};

	var spring = new Renderer(document.getElementById('spring'), WIDTH, HEIGHT, function (n, height) {
		this.drawImage(graph.canvas, 0, 0);
		
		this.lineWidth = 5;
		this.beginPath();
		this.moveTo(STRING_POS, 0);
		this.arc(STRING_POS, 0, 12, 0, 2 * PI);
		this.fill();
		
		// omega = 2 pi / "period"
		height -= SPRING_BUFFER_HEIGHT * 2;
		var omega = 2 * PI / (height / n);
		this.beginPath();
		this.moveTo(STRING_POS, 0);
		for (var t = 0; t < height && t < 2 * HEIGHT; t += 0.02)
			this.lineTo(STRING_POS + SPRING_WIDTH * sin(omega * t), t + SPRING_BUFFER_HEIGHT);
			
		height += SPRING_BUFFER_HEIGHT * 2;
		this.lineTo(STRING_POS, height);
		this.stroke();
		
		// Draw the block
		this.globalAlpha = 0.8;
		this.fillStyle = 'yellow';
		this.beginPath();
		this.rect(STRING_POS - BLOCK_WIDTH / 2, height, BLOCK_WIDTH, BLOCK_HEIGHT);
		this.fill();
		this.stroke();
		this.globalAlpha = 1;
		
		this.beginPath();
		this.fillStyle = 'black';
		this.arc(STRING_POS, height, 12, 0, 2 * PI);
		this.fill();
	});
	
	// Trace the block as it moves.
	var graph = new Renderer(document.createElement('canvas'), WIDTH, HEIGHT, function (time) {
		// Draw a line at equilibrium position
		this.beginPath();
		this.strokeStyle = '#ccc';
		this.lineWidth = 3;
		this.moveTo(0, SPRING_EQUIL_Y + BLOCK_HEIGHT / 2);
		this.lineTo(WIDTH, SPRING_EQUIL_Y + BLOCK_HEIGHT / 2);
		this.stroke();
		
		// Draw a tick every second
		for (var s = -PIXELS_PER_MS * (time % 1000); s < WIDTH; s += PIXELS_PER_MS * 1000) {
			this.beginPath();
			this.moveTo(s, SPRING_EQUIL_Y + BLOCK_HEIGHT / 2 + TICK_HEIGHT / 2);
			this.lineTo(s, SPRING_EQUIL_Y + BLOCK_HEIGHT / 2 - TICK_HEIGHT / 2);
			this.stroke();
		}
		
		// Draw line.
		this.strokeStyle = 'violet';
		this.beginPath();
		for (var i = 0; i < graph.points.length; i++)
			this.lineTo(STRING_POS - (time - graph.points[i][0]) * PIXELS_PER_MS, graph.points[i][1]);
		this.stroke();
	});
	graph.points = [];
	graph.push = function (t, y) {
		graph.points.push([t, y + BLOCK_HEIGHT / 2]);
		if (graph.points[0] && t1 - graph.points[0][0] > GRAPH_PERIOD)
			graph.points.shift();
	};
	
	// Lorentzian
	var lorentzian = new Renderer(document.getElementById('lorentzian'), LORENTZIAN_WIDTH, LORENTZIAN_HEIGHT, function (m, b, k, omegaf) {
		var amplitudeVsOmega = function (omega) { return 1 / sqrt(sq(k / m - sq(omega)) + sq(omega * b / m)); };
		
		// Draw a line at current omega
		this.strokeStyle = '#ccc';
		this.lineWidth = 1;
		this.beginPath();
		this.moveTo(omegaf * LORENTZIAN_WIDTH / LORENTZIAN_MAX, 0);
		this.lineTo(omegaf * LORENTZIAN_WIDTH / LORENTZIAN_MAX, LORENTZIAN_HEIGHT);
		this.stroke();
		
		// Draw curve
		this.strokeStyle = 'violet';
		this.beginPath();
		for (var o = 0; o < LORENTZIAN_MAX; o += 0.1)
			this.lineTo(o * LORENTZIAN_WIDTH / LORENTZIAN_MAX, LORENTZIAN_HEIGHT * (1 - amplitudeVsOmega(o)));
		this.stroke();
		
	});
	
	var y = BLOCK_Y; // pixels
	var v = 0; // pixels / second
	var t0, t1; // The last time we numerically integrated
	
	// Modify our constants	
	var zeta = control('zeta', id, id, disabled);
	var omega0 = control('omega0', id, id, disabled);
	var omega1 = control('omega1', id, id, disabled);
	var T = control('T', id, id, disabled);
	
	function output() {
		var o0 = omega0(sqrt(k / m));
		var o1 = omega1(sqrt(k / m - sq(b / m / 2)) || "?");
		T(typeof o1 == 'number' ? 2 * PI / o1 : "?");
		zeta(b / m / o0 / 2);
		lorentzian.render(m, b, k, omegaf);
	}
	
	var m, k, b, f0, omegaf;
	control('m', id, id, function (m_) { m = m_; output(); });
	control('b', exp0, log, function (b_) { b = b_; output(); });
	control('k', exp, log, function (k_) { k = k_; output(); });
	var ff = control('f', id, id, function (f_) { f0 = f_; });
	var omegaff = control('omegaf', id, id, function (omegaf_) { omegaf = omegaf_; output(); });
	
	// Forcing
	var f = function (t) {
		return ff(f0 * cos(omegaf * t / 1000));
	}; // mass * pixels / second^2
	document.getElementById('f-reset').onclick = function () {
		document.getElementById('f-oscillation').innerHTML = 'turn oscillation on';
		document.getElementById('controls').classList.remove('f-oscillating');
		
		f0 = ff(0);
		omegaf = omegaff(0);
		output();
		return false;
	};
	document.getElementById('f-oscillation').onclick = function () {
		document.getElementById('controls').classList.toggle('f-oscillating');
		if (document.getElementById('controls').classList.contains('f-oscillating')) {
			this.innerHTML = 'turn oscillation off';
			
			// Sensible default values
			f0 = ff(5000);
			omegaf = omegaff(LORENTZIAN_MAX / 2);
			output();
		} else
			document.getElementById('f-reset').onclick();
		return false;
	};
	
	
	requestAnimationFrame(function step(time) {
		
		if (isNaN(t0)) {
			t0 = time;
			t1 = 0;
		}
		
		var t = time - t0;
		var dt = t - t1;
		
		// The user left the page for a while... pick up where they left off.
		if (dt > 1000) {
			t0 += dt;
			t = t1;
			dt = 0;
		}
	
		// Numerically integrate
		if (!dragging) {
			v += (-b * v - k * (y - SPRING_EQUIL_Y) - f(t)) * dt / 1000 / m;
			y += v * dt / 1000;
		}
		
		graph.push(t, y);
		graph.render(t);
		
		// Spring constant is proportional to number of coils squared... why not?
		spring.render(Math.round(Math.pow(k, 1 / 2)), y);
		
		t1 = t;
		requestAnimationFrame(step);
	});
	
	// Dragging the block
	var dragging = false;
	var grabberY, points;
	spring.canvas.onmousedown = function (e) {
		var mx = e.clientX - this.offsetLeft;
		var my = e.clientY - this.offsetTop;
		var bx = mx - STRING_POS;
		if (Math.abs(bx) <= BLOCK_WIDTH / 2) {
			dragging = true;
			v = 0;
			points = [[Date.now() / 1000, y]];
			grabberY = my - y;
		}
	};
	spring.canvas.onmousemove = function (e) {
		if (dragging) {
			var my = e.clientY - this.offsetTop;
			y = my - grabberY;
			points.push([Date.now() / 1000, y]);
		}
	};
	spring.canvas.onmouseup = function (e) {
		if (dragging) {
			dragging = false;
			
			// Differentiate points 
			points = points.slice(-5);
			var l = points.length - 1;
			v = (points[l][1] - points[0][1]) / (points[l][0] - points[0][0]) || 0;
		}
	};
	
	// Scroll wheel support.
	document.body.onmousewheel = function (e) {
		v += -e.wheelDelta * 60 / 120;
	};
};