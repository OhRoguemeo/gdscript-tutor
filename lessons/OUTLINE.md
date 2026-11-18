# GDScript Tutor — Lesson Outline

This outline is for the GDScript tutor web app, a responsive progressive web app you can use on a PC, a laptop, or a phone. The tutor is being built **before** the Godot 4 first-person horror game, so every lesson is a skill you will use in that game.

There is no in-browser code runner in version 1, and no server-side sandbox. You will read the lessons, take short quizzes, and — for the Signals practice and the Capstone mini-game — **download a starter Godot 4 project (.zip) and run it in the Godot editor** on your computer.

---

## Module 1 — Variables

A variable is a named box that holds a value you can read and change while the game runs.

### 1.1 What a variable is

**Plain language:** Think of a labeled box. The label is the name. What is inside is the value. You can look in the box, or put something new in it, as the game runs.

**Godot 4 angle:** In GDScript you declare a variable with `var`. A fear meter can start at zero and climb as the player gets scared:

```gdscript
var fear := 0.0
```

The `:=` symbol means "figure out the type from this value." Here Godot knows `fear` is a decimal number (a `float`).

### 1.2 Names and assignment

**Plain language:** Pick clear names. `fear` is better than `f`. You change a variable by assigning a new value with `=`.

**Godot 4 angle:**

```gdscript
var flashlight_battery := 100.0
flashlight_battery = 80.0
```

That is a flashlight battery starting full, then dropping after some use.

### 1.3 Exported variables and the Inspector

**Plain language:** Some values are more fun to tweak without opening the code — starting fear, how fast the battery drains, how far the monster can hear.

**Godot 4 angle:** Put `@export` above a variable and it shows up in the Inspector, where you can change it while you test:

```gdscript
@export var max_fear := 100.0
@export var hear_distance := 15.0
```

### 1.4 Constants

**Plain language:** A constant is a value that should not change, like a hard cap on fear or the number of inventory slots.

**Godot 4 angle:** Use `const` for those. Godot will report an error if the code tries to change them.

```gdscript
const MAX_INVENTORY_SLOTS := 8
```

### 1.5 Values that change over time

**Plain language:** Horror games live on numbers that creep. Fear rises. Batteries fall. Stamina drains when you sprint.

**Godot 4 angle:** You will later update these every frame or when something happens, for example `fear = fear + 5.0` when a door slams. Module 5 will wrap that kind of change in a function.

**Horror tie-in:** By the end of this module you can describe a fear meter, a flashlight battery, and a stamina value as variables in your future first-person horror game.

---

## Module 2 — Data Types

A type is the kind of value a variable holds: a number, a yes/no flag, a list, and so on. Picking the right type keeps the game predictable.

### 2.1 Numbers: `int` and `float`

**Plain language:** Whole numbers (`int`) are for counts: how many matches you have, which floor you are on. Decimal numbers (`float`) are for amounts that can be in between: fear, distance, microphone volume, how much battery is left.

**Godot 4 angle:**

```gdscript
var match_count: int = 3
var fear: float = 0.0
var hear_distance: float = 15.0
```

Type hints like `: int` and `: float` are optional, but they catch mistakes early.

### 2.2 Strings and booleans

**Plain language:** A string is text, such as a journal line or a monster's display name. A boolean is only `true` or `false`, such as "is the flashlight on?" or "is the player hiding?"

**Godot 4 angle:**

```gdscript
var journal_line := "I heard the floorboards again."
var is_flashlight_on := false
var is_hiding := true
```

### 2.3 Arrays: lists of things

**Plain language:** An array is a list, in order. You might keep a list of items in the inventory, or a list of sound sources the monster has noticed.

**Godot 4 angle:**

```gdscript
var inventory: Array[String] = ["flashlight", "key"]
var heard_sounds: Array[String] = []
```

You will loop over lists like these in Module 4.

### 2.4 Dictionaries: labeled values

**Plain language:** A dictionary is a collection of labeled values, like a tiny filing cabinet. Useful for settings or a bundle of stats that belong together.

**Godot 4 angle:**

```gdscript
var player_stats := {
    "fear": 0.0,
    "stamina": 100.0,
    "battery": 100.0,
}
```

### 2.5 `null` and careful checks

**Plain language:** `null` means "nothing is here yet." That is normal when a node or item has not been set. Always check before you use it, or the game can crash at the worst moment — mid-scare.

**Godot 4 angle:** Check with `if monster != null:` before you read the monster's position. In the horror game, that matters when a creature is spawned only after a trigger, not at the start of the scene.

---

## Module 3 — Conditionals

Conditionals let the game choose a path: if this is true, do that. This is how a monster decides whether it heard you.

### 3.1 `if`, `elif`, and `else`

**Plain language:** "If the flashlight is off, the player is harder to see. Otherwise, the monster can spot them sooner."

**Godot 4 angle:**

```gdscript
func spotting_range() -> float:
    if is_flashlight_on:
        return 20.0
    else:
        return 8.0
```

Use `elif` (else-if) when you have more than two branches, such as calm, uneasy, and panicked fear levels.

### 3.2 Comparisons and logic

**Plain language:** You compare values with `>`, `<`, `==` (equal), and `!=` (not equal). You combine checks with `and` and `or`.

**Godot 4 angle:** The monster hears you only if you are both loud enough *and* close enough:

```gdscript
if mic_volume > threshold and distance_to_player <= hear_distance:
    player_heard.emit()
```

### 3.3 Looking, hiding, and stacked checks

**Plain language:** Real scares often need more than one condition. Is the player looking at the monster? Are they hiding? Is fear already high?

**Godot 4 angle:** You can nest checks, or keep them flat with `and` / `or`. For example, a stare mechanic: if the player is looking at the monster *and* the monster is in range, raise fear faster. If the player is hiding in a locker, skip the sight check.

### 3.4 `match` for clear branches

**Plain language:** When one value can be several named states, a `match` is often easier to read than a long `if` / `elif` chain.

**Godot 4 angle:**

```gdscript
match fear_state:
    "calm":
        music_volume = 0.2
    "uneasy":
        music_volume = 0.5
    "panicked":
        music_volume = 0.8
    _:
        music_volume = 0.2
```

The `_` branch is the fallback, like "anything else."

### 3.5 Putting it on a fear meter

**Plain language:** Conditionals are how the meter starts to *mean* something in the game, not just a number on a page.

**Godot 4 angle:** If `fear` crosses a threshold, you might shake the camera, darken the edges of the screen, or let the monster move faster. Those rules will live in `if` and `match` blocks you can tune in the Inspector with `@export` thresholds.

---

## Module 4 — Loops

A loop repeats work: once for each item in a list, or until a condition is no longer true.

### 4.1 `for` loops over a range

**Plain language:** "Do this ten times" or "count from 1 to 5." Useful for a short flicker, a countdown, or stepping through a fixed number of lights.

**Godot 4 angle:**

```gdscript
func flicker_lights(times: int) -> void:
    for i in range(times):
        hallway_light.visible = not hallway_light.visible
        await get_tree().create_timer(0.08).timeout
    hallway_light.visible = true
```

`range(times)` gives you `0, 1, 2, ...` up to but not including `times`.

### 4.2 `for` loops over arrays

**Plain language:** "For each item in the inventory..." or "for each nearby sound..." the game does the same kind of check.

**Godot 4 angle:** A monster can scan every sound it has noticed:

```gdscript
for sound in heard_sounds:
    if sound.volume > threshold:
        investigate(sound.position)
        break
```

`break` leaves the loop early once a decision is made — no need to keep scanning after the monster has picked a target.

### 4.3 `while` loops

**Plain language:** A `while` loop keeps going as long as something is true. Use it carefully so it cannot run forever.

**Godot 4 angle:** A drain loop might keep lowering the flashlight battery while the light is on, but in Godot you will more often do that work a little at a time in `_process` rather than in a tight `while`. Save `while` for cases such as "keep searching a list until you find a hiding spot or run out of options."

### 4.4 `break` and `continue`

**Plain language:** `break` stops the loop. `continue` skips the rest of this pass and goes to the next item.

**Godot 4 angle:** When you loop over characters in range, `continue` can skip the player themselves or anyone already hiding, and `break` can stop once you have found the closest threat. That is how a cheap "who can hear me?" check stays readable.

**Horror tie-in:** Loops are how a creature checks several rooms, several sound sources, or several lights without you copying the same code over and over.

---

## Module 5 — Functions

A function is a named recipe: a pack of steps you can run whenever you need them. Functions keep the game code tidy and reusable.

### 5.1 Writing a `func`

**Plain language:** You give the recipe a name, list what it needs (parameters), and optionally give something back (a return value).

**Godot 4 angle:**

```gdscript
func raise_fear(amount: float) -> void:
    fear = clampf(fear + amount, 0.0, max_fear)
```

`-> void` means this function does not return a value. It just changes `fear` and keeps it between `0.0` and `max_fear`.

### 5.2 Parameters, returns, and type hints

**Plain language:** Parameters are the ingredients you pass in. A return value is the result you get back. Type hints say what kinds of values are allowed.

**Godot 4 angle:**

```gdscript
func distance_to_player(monster: Node3D, player: Node3D) -> float:
    return monster.global_position.distance_to(player.global_position)
```

Now any other code can ask, "how far is the monster from the player?" and get a `float` back.

### 5.3 When to split work into functions

**Plain language:** If you are copying the same steps in two places, or a block of code is hard to explain in one breath, it probably wants to be a function. Good names read like instructions: `toggle_flashlight()`, `raise_fear()`, `is_monster_in_view()`.

**Godot 4 angle:** Built-in functions such as `_ready()` and `_process(delta)` are also just functions Godot calls for you. You will put your own functions next to them on the same script.

### 5.4 Waiting with `await`

**Plain language:** Sometimes the next step should not happen until a sound finishes, a timer ends, or a door has finished opening.

**Godot 4 angle:** `await` pauses this function without freezing the whole game:

```gdscript
func play_scare() -> void:
    $Scream.play()
    await $Scream.finished
    raise_fear(15.0)
```

The scream plays, the function waits until it is done, then fear jumps.

### 5.5 A flashlight and a fear meter as functions

**Plain language:** Once these two actions are functions, the rest of the game can call them from input, from a monster, or from a scripted scare.

**Godot 4 angle:**

```gdscript
func toggle_flashlight() -> void:
    is_flashlight_on = not is_flashlight_on
    flashlight_light.visible = is_flashlight_on
```

You will hook this to a button or key later. Combined with `raise_fear()`, you already have the two actions a simple horror vignette needs most.

---

## Module 6 — Signals

A signal is a message a node can send when something happens. Other nodes can listen and react, without being tightly tied together.

**Game section:** The practice for this module is not an in-browser exercise. You will **download a starter Godot 4 project (.zip) and run it in the Godot editor**.

### 6.1 What a signal is

**Plain language:** Think of a fire alarm. The alarm does not know who will respond. It just goes off. Anyone who has agreed to listen can react — lights, a door, the monster, the fear meter.

**Godot 4 angle:** Signals are Godot's built-in way to say "this happened" without hard-wiring every object to every other object. The flashlight can announce that it was toggled. The fear meter can announce that fear changed. A vision script can announce that the player was spotted.

### 6.2 Declaring a signal

**Plain language:** You list the messages a script is allowed to send, and what information those messages carry.

**Godot 4 angle:**

```gdscript
signal fear_changed(new_fear: float)
signal flashlight_toggled(is_on: bool)
signal player_spotted
```

Those declarations usually sit near the top of the script, with your variables.

### 6.3 Sending a signal with `emit()`

**Plain language:** When the event actually happens, you fire the message.

**Godot 4 angle:** In Godot 4 you call `emit()` on the signal itself, not a separate `emit_signal()` function:

```gdscript
func raise_fear(amount: float) -> void:
    fear = clampf(fear + amount, 0.0, max_fear)
    fear_changed.emit(fear)

func toggle_flashlight() -> void:
    is_flashlight_on = not is_flashlight_on
    flashlight_toggled.emit(is_flashlight_on)
```

### 6.4 Listening with `connect()`

**Plain language:** A listener signs up to be told when the signal fires, and names the function that should run.

**Godot 4 angle:** In Godot 4 you connect the signal to a function (a Callable):

```gdscript
func _ready() -> void:
    fear_changed.connect(_on_fear_changed)
    flashlight_toggled.connect(_on_flashlight_toggled)

func _on_fear_changed(new_fear: float) -> void:
    # Later: update a fear bar on the screen.
    pass

func _on_flashlight_toggled(is_on: bool) -> void:
    flashlight_light.visible = is_on
```

Now the UI can react to fear, and the light can react to the toggle, without those scripts rewriting each other.

### 6.5 Practice: download the starter project

**Delivery:** Download a starter Godot 4 project (.zip) and run it in the Godot editor. There is no in-browser code execution for this step.

**What you will do in the editor:** Open the starter scene, find the empty `signal` declarations, hook up `emit()` where the flashlight toggles and where fear changes, then `connect()` those signals to a simple on-screen label or light. When you press the flashlight key, the light should respond because of the signal, not because the input code reached into the light directly.

**Horror tie-in:** These same signals — `fear_changed`, `flashlight_toggled`, `player_spotted` — are the nervous system of the full first-person horror game.

---

## Module 7 — Capstone mini-game

You put the earlier modules together in a short horror vignette, still inside Godot 4 — not in the browser.

**Game section:** **Download a starter Godot 4 project (.zip) and run it in the Godot editor.** Version 1 has no in-browser playable game and no server-side sandbox.

### 7.1 What you will build

**Plain language:** A small, playable scare, not the whole game. You walk a short space, you have a flashlight, a fear meter rises when something goes wrong, and a creature reacts if you make noise or point the light at the wrong time.

**Godot 4 angle:** The starter project will already have a simple first-person scene, a flashlight node, a fear value, and a creature placeholder. Your job is to wire the GDScript: variables and types, the `if` checks, a loop if you need to scan sound sources, functions such as `raise_fear()` and `toggle_flashlight()`, and the signals that keep those pieces talking.

### 7.2 Download and open the starter project

**Delivery:** Download a starter Godot 4 project (.zip) and run it in the Godot editor.

**Plain language:** Unzip the file, open Godot 4, choose **Import**, and point it at the project folder. Press F5 (or the Play button) to run the scene. You should see the starter room before you have written anything new.

**Godot 4 angle:** Work only in the scripts the README inside the zip points you to. You do not need to build a 3D world from scratch for this capstone.

### 7.3 How the systems fit together

**Plain language:** This is the map of everything you have learned, in one place.

**Godot 4 angle:**

- **Variables and types:** `fear`, `flashlight_battery`, `is_flashlight_on`, `hear_distance`.
- **Conditionals:** if the mic or a "noise" key goes over a threshold *and* the creature is close, it hears you; if you are looking at it with the light on, fear rises faster.
- **Loops:** scan a short list of sound sources or nearby points of interest.
- **Functions:** `raise_fear()`, `toggle_flashlight()`, and a helper such as `distance_to_player()`.
- **Signals:** `fear_changed.emit()`, `flashlight_toggled.emit()`, `player_spotted.emit()`, each connected with `connect()` to the UI or the creature.

### 7.4 What "done" looks like

**Plain language:** You can play through the vignette and *feel* the systems. The flashlight key toggles a visible beam. The fear meter moves when a scare happens. The creature reacts at least once — it turns, it moves closer, or a label tells you that you were spotted.

**Godot 4 angle:** All of that should happen through your functions and signals, with `@export` values you can tweak in the Inspector (hear distance, fear step, battery drain) without rewriting the logic.

### 7.5 What comes next for the full game

**Plain language:** The capstone is a rehearsal, not the finished horror game. After this, you can grow the same systems: a real microphone input, a fuller fear state, looking-direction checks, and richer creature behavior.

**Godot 4 angle:** The tutor stays your reference. The full game can keep the same signal names and function style, so work you do here is not throwaway practice — it is the first draft of the game's rules.

---

*Version 1 note:* Game sections (Module 6 practice and Module 7) use downloadable starter Godot 4 projects. They are not run in the browser. The `.zip` files will live in the `starter-projects/` folder in a later pass. GitHub and GitHub Pages are set up later, on the main PC.
