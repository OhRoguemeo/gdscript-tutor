---
id: 05-functions
module: 5
title: "Functions: Named Recipes the Game Can Reuse"
level: beginner
estimated_minutes: 20
---

# Functions: Named Recipes the Game Can Reuse

## What is a function?
A function is a named recipe: a pack of steps you can run whenever you need them. You give the recipe a name, list what it needs (parameters), and optionally give something back (a return value). Functions keep the game code tidy. If you are copying the same steps in two places, those steps probably want to be a function.

Good names read like instructions: `toggle_flashlight()`, `raise_fear()`, `spotting_range()`.

## Writing a func
In GDScript you start a function with the word `func`, then a name, then parentheses. Inside the parentheses you list parameters. After the parentheses you can write `->` and a return type.

```gdscript
func raise_fear(amount: float) -> void:
	fear = clampf(fear + amount, 0.0, max_fear)
```

`amount: float` means this function expects a decimal number. `-> void` means it does not return a value. It just changes `fear`. `clampf` keeps that new value between `0.0` and `max_fear`, so fear cannot go below zero or past the cap.

To run the recipe, you **call** it by writing its name and passing in a value:

```gdscript
raise_fear(0.4)
```

## Parameters, returns, and type hints
Parameters are the ingredients you pass in. A return value is the result you get back. Type hints say what kinds of values are allowed.

```gdscript
func spotting_range() -> float:
	if is_flashlight_on:
		return 20.5
	else:
		return 8.5
```

`-> float` means the function gives a decimal number back. Other code can ask, "how far can the monster see right now?" and use that number.

Built-in functions such as `_ready()` are also just functions. Godot calls `_ready()` for you when the node enters the scene. You put your own functions next to it on the same script.

## Waiting with await
Sometimes the next step should not happen until a timer ends, a sound finishes, or a door has finished opening. `await` pauses this function without freezing the whole game:

```gdscript
await get_tree().create_timer(0.5).timeout
```

That line waits half a second, then the function continues. The rest of the game keeps running in the meantime.

## Code example: a flashlight, a fear meter, and a delayed scare
```gdscript
extends Node

var fear: float = 0.25
var max_fear: float = 1.25
var is_flashlight_on: bool = false

func raise_fear(amount: float) -> void:
	fear = clampf(fear + amount, 0.0, max_fear)

func toggle_flashlight() -> void:
	is_flashlight_on = not is_flashlight_on

func spotting_range() -> float:
	if is_flashlight_on:
		return 20.5
	else:
		return 8.5

func play_scare() -> void:
	print("A pipe bursts in the dark.")
	await get_tree().create_timer(0.5).timeout
	raise_fear(0.4)
	print("Fear after the scare: ", fear)

func _ready() -> void:
	print("Starting fear: ", fear)
	toggle_flashlight()
	print("Flashlight on: ", is_flashlight_on)
	print("Spotting range: ", spotting_range())
	await play_scare()
	raise_fear(0.8)
	print("Fear after another hit: ", fear)
```

**Output:**
```
Starting fear: 0.25
Flashlight on: true
Spotting range: 20.5
A pipe bursts in the dark.
Fear after the scare: 0.65
Fear after another hit: 1.25
```

Why that output? Fear starts at `0.25`. `toggle_flashlight()` flips the light from off to on, so the spotting range is `20.5`. After the pipe bursts, the function waits half a second, then `raise_fear(0.4)` makes fear `0.65`. The last call, `raise_fear(0.8)`, would be `1.45`, but `clampf` caps it at `max_fear`, so the final value is `1.25`.

## Quick tips
- Names use `snake_case`, just like variables: `raise_fear`, not `RaiseFear`.
- Parentheses are required when you call a function, even if it has no parameters: `toggle_flashlight()`.
- If you are copying the same steps twice, pull them into a function.
- `await` only pauses the function that uses it. The rest of the game does not freeze.

## Quiz

**1. What is a function?**
- A) A labeled box that holds one value
- B) A named recipe: a pack of steps you can run whenever you need them ✅
- C) A list of items in order
- D) A yes-or-no flag

**2. In `func raise_fear(amount: float) -> void:`, what does `-> void` mean?**
- A) The function returns a decimal number
- B) The function must not be called
- C) The function does not return a value ✅
- D) The function waits for a timer

**3. What does `clampf(fear + amount, 0.0, max_fear)` do?**
- A) Turns fear into text
- B) Keeps the new fear value between `0.0` and `max_fear` ✅
- C) Always sets fear to `0.0`
- D) Deletes the fear variable

**4. What does `await get_tree().create_timer(0.5).timeout` do?**
- A) Closes the game after half a second
- B) Pauses this function for half a second without freezing the whole game ✅
- C) Speeds the game up
- D) Restarts the scene

<!-- quiz-answers: 1=B, 2=C, 3=B, 4=B -->

## Next up
In Lesson 6 you'll learn signals, Godot's way of saying "this happened" so other parts of the game can react. That lesson uses a starter Godot 4 project you download and run in the editor.
