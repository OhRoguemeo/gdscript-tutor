---
id: 04-loops
module: 4
title: "Loops: Doing the Same Work More Than Once"
level: beginner
estimated_minutes: 20
---

# Loops: Doing the Same Work More Than Once

## What is a loop?
A loop repeats work: once for each item in a list, or until a condition is no longer true. That is how a creature can check several rooms, several sound sources, or several lights without you copying the same code over and over.

## for loops over a range
`range(times)` gives you `0, 1, 2, ...` up to but not including `times`. Useful for a short flicker, a countdown, or stepping through a fixed number of lights.

```gdscript
for i in range(3):
	print("Flicker ", i)
```

That prints `Flicker 0`, then `Flicker 1`, then `Flicker 2`. It does not print `3`, because `range(3)` stops before `3`.

In a real scare you might also wait a beat between flickers with `await get_tree().create_timer(0.08).timeout`. You will practice `await` in Lesson 5. Here we print, so you can see each pass clearly.

## for loops over arrays
"For each item in the inventory..." or "for each nearby room..." the game does the same kind of check.

```gdscript
for room in rooms:
	print("Checking the ", room, ".")
```

## while loops
A `while` loop keeps going as long as its condition is true. Use it carefully so it cannot run forever. In Godot you will often drain a flashlight battery a little at a time in `_process` rather than in a tight `while`. Save `while` for cases such as "keep searching until you find a hiding spot or run out of options."

## break and continue
`break` stops the loop right away. `continue` skips the rest of this pass and goes to the next item. When you loop over rooms, `continue` can skip a hallway you already cleared, and `break` can stop once you have found something in the basement.

## Code example: flicker, search, and a draining battery
```gdscript
extends Node

var rooms: Array[String] = ["Kitchen", "Hallway", "Basement", "Attic"]

func _ready() -> void:
	# for over a range: 0, 1, 2 — up to but not including 3
	for i in range(3):
		print("Flicker ", i)

	# for over an array
	for room in rooms:
		if room == "Hallway":
			continue  # skip the rest of this pass, go to the next room
		if room == "Basement":
			print("Checking the ", room, "... something is here.")
			break  # leave the loop early
		print("Checking the ", room, ".")

	# while: keep going as long as the condition is true
	var battery: float = 2.5
	while battery > 0.0:
		print("Battery at ", battery)
		battery -= 1.0
```

**Output:**
```
Flicker 0
Flicker 1
Flicker 2
Checking the Kitchen.
Checking the Basement... something is here.
Battery at 2.5
Battery at 1.5
Battery at 0.5
```

Why that output? The flicker loop runs three times, starting at `0`. The room loop prints the Kitchen, skips the Hallway with `continue`, finds something in the Basement and `break`s, so the Attic is never checked. The `while` prints the battery at `2.5`, then `1.5`, then `0.5`. After that last print it subtracts `1.0` and the value is no longer greater than `0.0`, so the loop stops.

## Quick tips
- `range(n)` starts at `0` and stops before `n`.
- If a `while` loop's condition never becomes false, the game can freeze. Always change something inside the loop that will eventually end it.
- `break` is a decision: "we found what we needed, stop looking."
- `continue` is a skip: "this item is not relevant, move on."

## Quiz

**1. What numbers does `range(3)` give you?**
- A) `1`, `2`, `3`
- B) `0`, `1`, `2` ✅
- C) `0`, `1`, `2`, `3`
- D) `3`, `2`, `1`

**2. What does `break` do in a loop?**
- A) Skips one item and keeps looping
- B) Restarts the loop from the beginning
- C) Stops the loop right away ✅
- D) Pauses the whole game

**3. What does `continue` do in a loop?**
- A) Stops the loop right away
- B) Skips the rest of this pass and goes to the next item ✅
- C) Repeats the current item forever
- D) Deletes the current item

**4. When does a `while` loop stop?**
- A) After exactly 10 passes
- B) When you press a key
- C) As soon as its condition is no longer true ✅
- D) Only if you use `match`

<!-- quiz-answers: 1=B, 2=C, 3=B, 4=C -->

## Next up
In Lesson 5 you'll pack steps into functions, so the rest of the game can call `raise_fear()` or `toggle_flashlight()` whenever it needs them.
