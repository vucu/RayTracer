/*******************************************
 *
 * CUSTOM
 */
// Intersection
function Intersection() {
    // Basic parameters
    this.ball = undefined;
    this.t = Number.POSITIVE_INFINITY;
    this.normal = vec4(0,0,0,0);
    this.ray = undefined;
}

Intersection.prototype.getPosition = function () {
    return this.ray.getPosition(this.t);
}

Intersection.prototype.getPosition3 = function () {
    return this.ray.getPosition3(this.t);
}

// Find reflected ray at intersection point
Intersection.prototype.getReflectedRay = function () {
    var V = normalize(subtract(this.ray.getOrigin3(), this.getPosition3()));
    var N = normalize(toVec3(this.normal));

    var dir = normalize(subtract(scale_vec(2 * dot(N, V), N), V)).concat(0.0);

    return new Ray(this.getPosition3().concat(1.0), dir);
}

// Find refracted ray at intersection point
Intersection.prototype.getRefractedRay = function () {
    var r = this.ball.refract_index;;
    var I = normalize(toVec3(this.ray.dir));
    var N = normalize(toVec3(this.normal));
    if (Math.abs(dot(I,N))<=0.01) return;

    var c = -dot(I,N);                     
    var costheta2 = 1 - r * r * (1 - c * c);
    if (costheta2 < 0) {
        return;	
    }
    var v1 = scale_vec(r, I);
    var v2 = scale_vec(r * c - Math.sqrt(costheta2), N);
    var T = add(v1,v2);

    return new Ray(this.getPosition3().concat(1), T.concat(0));
}

// Ray
function Ray(origin, dir) {
    if (origin.length !== 4) throw "origin must have length 4";
    if (dir.length !== 4) throw "dir must have length 4";
    if (origin) this.origin = origin;
    else this.origin = vec4(0,0,0,1);
    if (dir) this.dir = dir;
    else this.dir = vec4(0,0,0,0);
}

Ray.prototype.getPosition = function (t) {
    if (typeof t === 'undefined') throw "Error: Must define t";
    return add(this.origin,scale_vec(t, this.dir));
}
Ray.prototype.getPosition3 = function (t) {
    if (typeof t === 'undefined') throw "Error: Must define t";
    var v4 = add(this.origin,scale_vec(t, this.dir));
    return vec3(v4[0], v4[1], v4[2]);
}

Ray.prototype.getOrigin3 = function () {
    return vec3(this.origin[0], this.origin[1], this.origin[2]);
}
Ray.prototype.getDir3 = function () {
    return vec3(this.dir[0], this.dir[1], this.dir[2]);
}

Ray.prototype.getDistance = function (t) {
    if (typeof t === 'undefined') throw "Error: Must define t";
    var begin = this.getOrigin3();
    var end = this.getPosition3(t);
    var offset = subtract(end,begin);
    return length(offset);
}

Ray.prototype.getInvert = function () {
    return new Ray(
        this.origin,
        vec4(-this.dir[0],-this.dir[1],-this.dir[2],0)
    );
}

// CS 174a Project 3 Ray Tracer Skeleton


function Ball() {                                 // *** Notice these data members. Upon construction, a Ball first fills them in with arguments:
    var members = ["position", "size", "color", "k_a", "k_d", "k_s", "n", "k_r", "k_refract", "refract_index"];
    for (i in arguments)    this[members[i]] = arguments[i];
    this.construct();
}

Ball.prototype.construct = function () {
    // TODO:  Give Ball any other data members that might be useful, assigning them according to this Ball's this.position and this.size members.
    // Matrix form
    var transform = mat4();
    transform = mult(transform, translation(this.position));
    transform = mult(transform, scale(this.size));
    this.model_transform = transform;
    this.model_transform_inverse = inverse(transform);
}

Ball.prototype.intersect = function (ray, existing_intersection, minimum_dist) {
    // TODO:  Given a ray, check if this Ball is in its path.  Recieves as an argument a record of the nearest intersection found
    //        so far, updates it if needed and returns it.  Only counts intersections that are at least a given distance ahead along the ray.
    //        An interection object is assumed to store a Ball pointer, a t distance value along the ray, and a normal.
    var intersection = new Intersection();
    intersection.ray = ray;
    intersection.ball = this;

    // Find ray inverse
    var ray_inverse = new Ray(
        mult_vec(this.model_transform_inverse, ray.origin),
        mult_vec(this.model_transform_inverse, ray.dir)
    );

    // Find the equation
    var a = dot(ray_inverse.getDir3(), ray_inverse.getDir3());
    var b = dot(ray_inverse.getOrigin3(), ray_inverse.getDir3());
    var c = dot(ray_inverse.getOrigin3(), ray_inverse.getOrigin3()) - 1;
    var discriminant = (b * b) - (a * c);

    // There's an intersection
    if(discriminant >= 0)
    {
        var t1 = -(b/a) + Math.sqrt(discriminant)/a;
        var t2 = -(b/a) - Math.sqrt(discriminant)/a;

        // Pick t
        var t;
        if (t1<=minimum_dist && t2<=minimum_dist) return existing_intersection;
        var smaller = t1<=t2 ? t1:t2;
        var bigger = t1>=t2 ? t1:t2;
        if (smaller <= minimum_dist) {
            t = bigger;
        }
        else t = smaller;

        intersection.t = t;
        // Compare with the current intersection, whichever closer is recognized
        if(!existing_intersection || !existing_intersection.ball || intersection.t < existing_intersection.t)
        {
            existing_intersection = new Intersection();
            existing_intersection.ray = intersection.ray;
            existing_intersection.t = intersection.t;
            existing_intersection.ball = intersection.ball;
            //Calculate the normal at the intersection point
            var tr = transpose(existing_intersection.ball.model_transform_inverse);

            // Calculate normal
            var normal;
            var normalFlipped;
            normal = mult_vec(tr, ray_inverse.getPosition(t));
            normal[3] = 0;
            normalFlipped = scale_vec(-1, normal)

            // Check interior, if it is, flip the normal
            if (dot(ray.getDir3(),toVec3(normal)) > 0) {
                var temp = normal;
                normal = normalFlipped;
                normalFlipped = temp;
            }

            existing_intersection.normal = normal;
        }
    }

    return existing_intersection;
}

var mult_3_coeffs = function (a, b) {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
};       // Convenient way to combine two color vectors

var background_functions = {                // These convert a ray into a color even when no balls were struck by the ray.
    waves: function (ray, distance) {
        return Color(.5 * Math.pow(Math.sin(2 * ray.dir[0]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[0] + Math.sin(10 * ray.dir[1]) + Math.sin(10 * ray.dir[2]))),
            .5 * Math.pow(Math.sin(2 * ray.dir[1]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[1] + Math.sin(10 * ray.dir[0]) + Math.sin(10 * ray.dir[2]))),
            .5 * Math.pow(Math.sin(2 * ray.dir[2]), 4) + Math.abs(.5 * Math.cos(8 * ray.dir[2] + Math.sin(10 * ray.dir[1]) + Math.sin(10 * ray.dir[0]))), 1);
    },
    lasers: function (ray, distance) {
        var u = Math.acos(ray.dir[0]), v = Math.atan2(ray.dir[1], ray.dir[2]);
        return Color(1 + .5 * Math.cos(Math.floor(20 * u)), 1 + .5 * Math.cos(Math.floor(20 * v)), 1 + .5 * Math.cos(Math.floor(8 * u)), 1);
    },
    mixture: function (ray, distance) {
        return mult_3_coeffs(background_functions["waves"](ray, distance), background_functions["lasers"](ray, distance)).concat(1);
    },
    ray_direction: function (ray, distance) {
        return Color(Math.abs(ray.dir[0]), Math.abs(ray.dir[1]), Math.abs(ray.dir[2]), 1);
    },
    color: function (ray, distance) {
        return background_color;
    }
};
var curr_background_function = "color";
var background_color = vec4(0, 0, 0, 1);

// *******************************************************
// Raytracer class - gets registered to the window by the Animation object that owns it
function Raytracer(parent) {
    var defaults = {
        width: 32,
        height: 32,
        near: 1,
        left: -1,
        right: 1,
        bottom: -1,
        top: 1,
        scanline: 0,
        visible: true,
        anim: parent,
        ambient: vec3(.1, .1, .1)
    };
    for (i in defaults)  this[i] = defaults[i];

    this.m_square = new N_Polygon(4);                   // For texturing with and showing the ray traced result
    this.m_sphere = new Subdivision_Sphere(4, true);    // For drawing with ray tracing turned off

    this.balls = [];    // Array for all the balls

    initTexture("procedural", true, true);      // Our texture for drawing the ray trace
    textures["procedural"].image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"   // Blank gif file

    this.scratchpad = document.createElement('canvas');   // A hidden canvas for assembling the texture
    this.scratchpad.width = this.width;
    this.scratchpad.height = this.height;

    this.scratchpad_context = this.scratchpad.getContext('2d');
    this.imageData = new ImageData(this.width, this.height);     // Will hold ray traced pixels waiting to be stored in the texture

    this.make_menu();
}

Raytracer.prototype.toggle_visible = function () {
    this.visible = !this.visible;
    document.getElementById("progress").style = "display:inline-block;"
};

Raytracer.prototype.make_menu = function ()      // The buttons
{
    document.getElementById("raytracer_menu").innerHTML = "<span style='white-space: nowrap'><button id='toggle_raytracing' class='dropbtn' style='background-color: #AF4C50'>Toggle Ray Tracing</button> \
                                                           <button onclick='document.getElementById(\"myDropdown2\").classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #8A8A4C'>Select Background Effect</button><div id='myDropdown2' class='dropdown-content'>  </div>\
                                                           <button onclick='document.getElementById(\"myDropdown\").classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #4C50AF'>Select Test Case</button><div id='myDropdown' class='dropdown-content'>  </div> \
                                                           <button id='submit_scene' class='dropbtn'>Submit Scene Textbox</button> \
                                                           <div id='progress' style = 'display:none;' ></div></span>";
    for (i in test_cases) {
        var a = document.createElement("a");
        a.addEventListener("click", (function (i, self) {
            return function () {
                load_case(i);
                self.parseFile();
            };
        })(i, this), false);
        a.innerHTML = i;
        document.getElementById("myDropdown").appendChild(a);
    }
    for (j in background_functions) {
        var a = document.createElement("a");
        a.addEventListener("click", (function (j) {
            return function () {
                curr_background_function = j;
            }
        })(j), false);
        a.innerHTML = j;
        document.getElementById("myDropdown2").appendChild(a);
    }

    document.getElementById("input_scene").addEventListener("keydown", function (event) {
        event.cancelBubble = true;
    }, false);

    window.addEventListener("click", function (event) {
        if (!event.target.matches('.dropbtn')) {
            document.getElementById("myDropdown").classList.remove("show");
            document.getElementById("myDropdown2").classList.remove("show");
        }
    }, false);

    document.getElementById("toggle_raytracing").addEventListener("click", this.toggle_visible.bind(this), false);
    document.getElementById("submit_scene").addEventListener("click", this.parseFile.bind(this), false);
}

Raytracer.prototype.getDir = function (ix, iy) {

    // TODO:  Maps an (x,y) pixel to a corresponding xyz vector that reaches the near plane.  This function, once finished,
    //        will help cause everything under the "background functions" menu to start working.
    var alpha = 1.0*ix/this.width;
    var beta = 1.0*iy/this.height;
    var x = 1.0*this.left + alpha * (this.right - this.left);
    var y = 1.0*this.bottom + beta * (this.top - this.bottom) ;
    var z = -1.0*this.near;
    var dir4 = vec4(x, y, z, 0.0);
    return dir4;
}

Raytracer.prototype.getSurfaceColor = function (closest_intersection) {
    // Init
    var closest = closest_intersection.ball;
    var color;

    // Ambient
    color = scale_vec(closest.k_a, closest.color).concat(1.0);

    //Compute the shadow ray for every light sources
    for (i=0;i<this.anim.graphicsState.lights.length;i++) {
        var light = this.anim.graphicsState.lights[i];
        var light_direction3 = subtract(toVec3(light.position), closest_intersection.getPosition3());
        var light_distance = length(light_direction3);
        var L = normalize(light_direction3);
        var N = normalize(toVec3(closest_intersection.normal));
        var NL = dot(N,L);
        var shadow_ray = new Ray(closest_intersection.getPosition(),L.concat(0.0));

        var j;
        var shadow_intersection = new Intersection();
        for (j=0;j<this.balls.length;j++) {
            var ball = this.balls[j]
            shadow_intersection = ball.intersect(shadow_ray, shadow_intersection, 0.0001);
        }

        // Check if the ray is in shadow
        var shadowCheck = false;
        if (NL<0) shadowCheck = true;
        if (shadow_intersection.ball) {
            var distance = shadow_intersection.ray.getDistance(shadow_intersection.t);
            if (distance < light_distance) shadowCheck = true;
        }

        // Shadow Rays
        if(!shadowCheck)
        {
            var V = normalize(subtract(toVec3(closest_intersection.ray.origin), closest_intersection.getPosition3()));
            var R = normalize(subtract(scale_vec(2.0*NL, N), L));
            var RV = dot(R, V);
            //Diffuse
            if(NL > 0)
            {
                var combined_color = mult(light.color, closest.color.concat(1.0));
                var added_color = scale_vec(closest.k_d * NL, combined_color);
                color = add(color, added_color)
            }
            //Specular
            if(RV > 0)
            {
                var added_color = scale_vec(closest.k_s * Math.pow(RV, closest.n),light.color) ;
                color = add(color, added_color)
            }
        }
    }


    return clamp01(color);
}

Raytracer.prototype.trace = function (ray, number_of_recursions_deep, shadow_test_light_source) {
    // TODO:  Given a ray, return the color in that ray's path.  Could be originating from the camera itself or from a secondary reflection
    //        or refraction off a ball.  Call Ball.prototype.intersect on each ball to determine the nearest ball struck, if any, and perform
    //        vector math (namely the Phong reflection formula) using the resulting intersection record to figure out the influence of light on
    //        that spot.
    //
    //        Arguments include some indicator of recursion level so you can cut it off after a few recursions.  Or, optionally,
    //        instead just store color_remaining, the pixel's remaining potential to be lit up more... proceeding only if that's still significant.
    //        If a light source for shadow testing is provided as the optional final argument, this function's objective simplifies to just
    //        checking the path directly to a light source for obstructions.
    if(number_of_recursions_deep >= 7)
        return mult_3_coeffs(this.ambient, background_functions[curr_background_function](ray)).concat(1);

    var closest_intersection = new Intersection();
    var type;
    if(number_of_recursions_deep == 0)
    {
        min_dist = 1.0;     // original
    } else
    {
        min_dist = 0.0001;  // reflected rays
    }
    var i;
    for (i=0;i<this.balls.length;i++) {
        var ball = this.balls[i];
        closest_intersection = ball.intersect(ray, closest_intersection, min_dist);
    }

    if (!closest_intersection.ball)
        return mult_3_coeffs(this.ambient, background_functions[curr_background_function](ray)).concat(1);

    //Do the tracing only if we have an intersection
    if(closest_intersection.ball) {
        //Get the closest ball
        var closest = closest_intersection.ball;

        //Start computing the pixel color
        var surface_color = this.getSurfaceColor(closest_intersection);
        var complement = vec4(1.0 - surface_color[0], 1.0 - surface_color[1], 1.0 - surface_color[2],1)

        //Reflection Rays
        var reflection = closest_intersection.getReflectedRay();
        var reflection_color = scale_vec(closest.k_r, this.trace(reflection, number_of_recursions_deep+1));

        //Refraction Rays
        var refraction = closest_intersection.getRefractedRay();
        var refraction_color = vec4(0,0,0,1);
        if (refraction) {
            refraction.isInsideBall = !ray.isInsideBall;
            refraction_color = scale_vec(closest.k_refract, this.trace(refraction, number_of_recursions_deep+1));
        }

        var r_color = mult_3_coeffs(complement, add(reflection_color, refraction_color)).concat(1)
        var pix_color = add(surface_color, r_color);
        return clamp01(pix_color);
    }
    //Return the background colour only if its the first ray
    if(number_of_recursions_deep == 0)
        return this.ambient;
    else
        return vec4();

}

Raytracer.prototype.parseLine = function (tokens)            // Load the text lines into variables
{
    switch (tokens[0]) {
        case "NEAR":
            this.near = parseFloat(tokens[1]);
            break;
        case "LEFT":
            this.left = parseFloat(tokens[1]);
            break;
        case "RIGHT":
            this.right = parseFloat(tokens[1]);
            break;
        case "BOTTOM":
            this.bottom = parseFloat(tokens[1]);
            break;
        case "TOP":
            this.top = parseFloat(tokens[1]);
            break;
        case "RES":
            this.width = parseFloat(tokens[1]);
            this.height = parseFloat(tokens[2]);
            this.scratchpad.width = this.width;
            this.scratchpad.height = this.height;
            break;
        case "SPHERE":
            this.balls.push(new Ball(vec3(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])), vec3(parseFloat(tokens[4]), parseFloat(tokens[5]), parseFloat(tokens[6])), vec3(parseFloat(tokens[7]), parseFloat(tokens[8]), parseFloat(tokens[9])),
                parseFloat(tokens[10]), parseFloat(tokens[11]), parseFloat(tokens[12]), parseFloat(tokens[13]), parseFloat(tokens[14]), parseFloat(tokens[15]), parseFloat(tokens[16])));
            break;
        case "LIGHT":
            this.anim.graphicsState.lights.push(new Light(vec4(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]), 1), Color(parseFloat(tokens[4]), parseFloat(tokens[5]), parseFloat(tokens[6]), 1), 100000));
            break;
        case "BACK":
            background_color = Color(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]), 1);
            gl.clearColor.apply(gl, background_color);
            break;
        case "AMBIENT":
            this.ambient = vec3(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
    }
}

Raytracer.prototype.parseFile = function ()        // Move through the text lines
{
    this.balls = [];
    this.anim.graphicsState.lights = [];
    this.scanline = 0;
    this.scanlines_per_frame = 1;                            // Begin at bottom scanline, forget the last image's speedup factor
    document.getElementById("progress").style = "display:inline-block;";        // Re-show progress bar
    this.anim.graphicsState.camera_transform = mat4();                          // Reset camera
    var input_lines = document.getElementById("input_scene").value.split("\n");
    for (var i = 0; i < input_lines.length; i++) this.parseLine(input_lines[i].split(/\s+/));
}

Raytracer.prototype.setColor = function (ix, iy, color)        // Sends a color to one pixel value of our final result
{
    var index = iy * this.width + ix;
    this.imageData.data[4 * index] = 255.9 * color[0];
    this.imageData.data[4 * index + 1] = 255.9 * color[1];
    this.imageData.data[4 * index + 2] = 255.9 * color[2];
    this.imageData.data[4 * index + 3] = 255;
}

Raytracer.prototype.display = function (time) {
    var desired_milliseconds_per_frame = 100;
    if (!this.prev_time) this.prev_time = 0;
    if (!this.scanlines_per_frame) this.scanlines_per_frame = 1;
    this.milliseconds_per_scanline = Math.max(( time - this.prev_time ) / this.scanlines_per_frame, 1);
    this.prev_time = time;
    this.scanlines_per_frame = desired_milliseconds_per_frame / this.milliseconds_per_scanline + 1;

    if (!this.visible) {                         // Raster mode, to draw the same shapes out of triangles when you don't want to trace rays
        for (i in this.balls)
            this.m_sphere.draw(this.anim.graphicsState, this.balls[i].model_transform, new Material(this.balls[i].color.concat(1),
                this.balls[i].k_a, this.balls[i].k_d, this.balls[i].k_s, this.balls[i].n));
        this.scanline = 0;
        document.getElementById("progress").style = "display:none";
        return;
    }
    ;
    if (!textures["procedural"] || !textures["procedural"].loaded) return;      // Don't display until we've got our first procedural image

    this.scratchpad_context.drawImage(textures["procedural"].image, 0, 0);
    this.imageData = this.scratchpad_context.getImageData(0, 0, this.width, this.height);    // Send the newest pixels over to the texture
    var camera_inv = inverse(this.anim.graphicsState.camera_transform);

    for (var i = 0; i < this.scanlines_per_frame; i++)     // Update as many scanlines on the picture at once as we can, based on previous frame's speed
    {
        var y = this.scanline++;
        if (y >= this.height) {
            this.scanline = 0;
            document.getElementById("progress").style = "display:none"
        }
        ;
        document.getElementById("progress").innerHTML = "Rendering ( " + 100 * y / this.height + "% )...";
        for (var x = 0; x < this.width; x++) {
            var ray = {origin: mult_vec(camera_inv, vec4(0, 0, 0, 1)), dir: mult_vec(camera_inv, this.getDir(x, y))};   // Apply camera

            // CUSTOM
            var rayObject = new Ray(ray.origin, ray.dir);

            this.setColor(x, y, this.trace(rayObject, 0));                                    // ******** Trace a single ray *********
        }
    }

    this.scratchpad_context.putImageData(this.imageData, 0, 0);                    // Draw the image on the hidden canvas
    textures["procedural"].image.src = this.scratchpad.toDataURL("image/png");      // Convert the canvas back into an image and send to a texture

    this.m_square.draw(new GraphicsState(mat4(), mat4(), 0), mat4(), new Material(Color(0, 0, 0, 1), 1, 0, 0, 1, "procedural"));

    if (!this.m_text) {
        this.m_text = new Text_Line(45);
        this.m_text.set_string("Open some test cases with the blue button.");
    }
    if (!this.m_text2) {
        this.m_text2 = new Text_Line(45);
        this.m_text2.set_string("Click and drag to steer.");
    }

    var model_transform = rotation(-90, vec3(0, 1, 0));
    model_transform = mult(model_transform, translation(.3, .9, .9));
    model_transform = mult(model_transform, scale(1, .075, .05));

    this.m_text.draw(new GraphicsState(mat4(), mat4(), 0), model_transform, true, vec4(0, 0, 0, 1 - time / 10000));
    model_transform = mult(model_transform, translation(0, -1, 0));
    this.m_text2.draw(new GraphicsState(mat4(), mat4(), 0), model_transform, true, vec4(0, 0, 0, 1 - time / 10000));
}

Raytracer.prototype.init_keys = function () {
    shortcut.add("SHIFT+r", this.toggle_visible.bind(this));
}

Raytracer.prototype.update_strings = function (debug_screen_object)    // Strings that this displayable object (Raytracer) contributes to the UI:
{
}