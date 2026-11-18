---
id: 03-conditionals
module: 3
title: "Conditionals: Teaching the Game to Choose"
level: beginner
estimated_minutes: 20
---

# Conditionals: Teaching the Game to Choose

## What is a conditional?
A conditional lets the game choose a path: if this is true, do that. This is how a monster decides whether it heard you, and how a fear meter starts to **mean** something, not just sit there as a number.

## if, elif, and else
`if` runs a block only when its condition is true. `else` runs when the `if` was false. `elif` (else-if) lets you add more branches, such as calm, uneasy, and panicked fear levels.

```gdscript
if is_flashlight_on:
	print("The beam cuts through the dark.")
else:
	print("The hallway stays black.")
```

Read it out loud as "if the flashlight is on, print the first line. Otherwise, print the second."

## Comparisons and logic
You compare values with these operators:

| Operator | Meaning |
|----------|---------|
| `==` | Equal to |
| `!=` | Not equal to |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal to |
| `<=` | Less than or equal to |

You combine checks with `and` (both must be true), `or` (at least one must be true), and `not` (flips true to false, and false to true). The monster hears you only if you are both loud enough **and** close enough:

```gdscript
if mic_volume > threshold and distance_to_player <= hear_distance:
	print("The monster heard you.")
```

`not is_flashlight_on` is `true` when the light is off.

## match for clear branches
When one value can be several named states, a `match` is often easier to read than a long `if` / `elif` chain. The `_` branch is the fallback, like "anything else."

```gdscript
match fear_state:
	"calm":
		print("Music volume: 0.2")
	"uneasy":
		print("Music volume: 0.5")
	"panicked":
		print("Music volume: 0.8")
	_:
		print("Music volume: 0.2")
```

## Code example: did the monster hear you?
```gdscript
extends Node

var is_flashlight_on: bool = true
var is_hiding: bool = false
var mic_volume: float = 0.8
var threshold: float = 0.5
var distance_to_player: float = 6.0
var hear_distance: float = 12.0
var fear: float = 0.6

func _ready() -> void:
	if is_flashlight_on:
		print("The beam cuts through the dark.")
	else:
		print("The hallway stays black.")

	if mic_volume > threshold and distance_to_player <= hear_distance:
		print("The monster heard you.")
	else:
		print("You stay unnoticed.")

	if is_hiding or not is_flashlight_on:
		print("Harder to spot.")
	else:
		print("You are easy to see.")

	if fear < 0.3:
		print("Fear state: calm")
	elif fear < 0.7:
		print("Fear state: uneasy")
	else:
		print("Fear state: panicked")

	var fear_state: String = "uneasy"
	match fear_state:
		"calm":
			print("Music volume: 0.2")
		"uneasy":
			print("Music volume: 0.5")
		"panicked":
			print("Music volume: 0.8")
		_:
			print("Music volume: 0.2")
```

**Output:**
```
The beam cuts through the dark.
The monster heard you.
You are easy to see.
Fear state: uneasy
Music volume: 0.5
```

Why that output? The flashlight is on, so the beam is visible and you are easy to see (`is_hiding` is false, and `not is_flashlight_on` is also false). The mic is at `0.8`, above the `0.5` threshold, and the player is `6.0` units away, inside the `12.0` hear distance, so the monster hears you. Fear is `0.6`, which is not under `0.3` but is under `0.7`, so the state is uneasy, and `match` sets the music to `0.5`.

## Quick tips
- Indent the lines that belong to an `if`, `elif`, `else`, or `match` branch. In GDScript that indent is a tab.
- `==` checks whether two values are equal. A single `=` is for assigning a value, not comparing.
- Real scares often need more than one check. You can stack them with `and` / `or`, or nest one `if` inside another.
- The `_` in a `match` is your safety net, so an unexpected state still does something safe.

## Quiz

**1. In an `if` / `elif` / `else` chain, when does `else` run?**
- A) Every time, after the other branches
- B) Only when every `if` and `elif` above it was false ✅
- C) Only when the flashlight is on
- D) Before the `if` runs

**2. What does `and` mean in `mic_volume > threshold and distance_to_player <= hear_distance`?**
- A) The check passes if either side is true
- B) The check passes only if both sides are true ✅
- C) The check flips true to false
- D) The check always fails

**3. What does `not is_flashlight_on` mean when the flashlight is on?**
- A) `true`
- B) `false` ✅
- C) `"on"`
- D) `0.0`

**4. In a `match`, what is the `_` branch?**
- A) The first branch that always runs
- B) A comment Godot ignores
- C) The fallback, for any value that did not match an earlier branch ✅
- D) A loop

<!-- quiz-answers: 1=B, 2=B, 3=B, 4=C -->

## Next up
In Lesson 4 you'll use loops to repeat work: flicker lights, scan a list of rooms, and stop early once the monster finds a target.
