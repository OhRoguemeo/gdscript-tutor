---
id: 02-data-types
module: 2
title: "Data Types: Picking the Right Kind of Box"
level: beginner
estimated_minutes: 20
---

# Data Types: Picking the Right Kind of Box

## What is a type?
A type is the kind of value a variable can hold. In Lesson 1 you met the four basic ones: `int`, `float`, `String`, and `bool`. Picking the right type keeps the game predictable. Health stays a whole number. Fear can sit between two whole numbers. A name stays text.

Here is a quick recap:

| Type | What it holds | Example |
|------|---------------|---------|
| `int` | Whole numbers, like a match count | `3`, `-1`, `0` |
| `float` | Numbers with a decimal point, like fear or distance | `0.5`, `12.5` |
| `String` | Text, inside quotes | `"Attic"`, `"Stay quiet."` |
| `bool` | Just `true` or `false` | `true` |

## Mixing an int and a float
If you add or multiply an `int` and a `float`, Godot gives you a `float`. The decimal is not thrown away.

```gdscript
var spare_cells: int = 2
var partial_charge: float = 0.5
var backup_power: float = spare_cells + partial_charge  # 2.5, a float
```

That is what you want for things like leftover battery power, where a whole number of cells plus a half charge still matters.

## Arrays: lists of things
An array is a list, in order. The first item is at index `0`, the second at `1`, and so on. You might keep the player's inventory, or the sounds a monster has heard.

```gdscript
var inventory: Array[String] = ["flashlight", "key"]
```

`inventory[0]` is `"flashlight"`. `inventory.size()` is how many items are in the list. You can add one with `append()`. You will loop over lists like these in Lesson 4.

## Dictionaries: labeled values
A dictionary is a collection of labeled values, like a tiny filing cabinet. Each label is called a **key**. Useful for a bundle of stats that belong together.

```gdscript
var player_stats := {
	"fear": 0.5,
	"stamina": 100.0,
	"battery": 80.5,
}
```

You read or change a value with its key: `player_stats["battery"]`.

## null and careful checks
`null` means "nothing is here yet." That is normal when a monster or item has not been set. Always check before you use it, or the game can crash at the worst moment — mid-scare.

```gdscript
if monster != null:
	print("The monster is already in the room.")
```

## Code example: inventory, stats, and an empty hallway
```gdscript
extends Node

# Recap: the four basic types
var spare_cells: int = 2
var fear: float = 0.5
var current_room: String = "Attic"
var flashlight_on: bool = true

# Array: a list, in order. The first item is at index 0.
var inventory: Array[String] = ["flashlight", "key"]

# Dictionary: labeled values
var player_stats := {
	"fear": 0.5,
	"stamina": 100.0,
	"battery": 80.5,
}

# null means "nothing is here yet"
var monster: Node = null

func _ready() -> void:
	# Mixing an int and a float gives a float
	var backup_power: float = spare_cells + 0.5
	print("Backup power: ", backup_power)

	inventory.append("matches")
	print("First item: ", inventory[0])
	print("Items carried: ", inventory.size())

	player_stats["battery"] = 72.5
	print("Battery: ", player_stats["battery"])

	if monster != null:
		print("The monster is already in the ", current_room, ".")
	else:
		print("The ", current_room, " is quiet. For now.")
```

**Output:**
```
Backup power: 2.5
First item: flashlight
Items carried: 3
Battery: 72.5
The Attic is quiet. For now.
```

## Quick tips
- Use an `int` for counts (matches, floors) and a `float` for amounts that can sit in between (fear, distance, battery).
- Array indexes start at `0`, not `1`.
- Dictionary keys are usually strings in quotes, like `"battery"`.
- If a node or item might not exist yet, check `!= null` before you use it.

## Quiz

**1. What happens when you add an `int` and a `float` in GDScript?**
- A) The game crashes
- B) You get an `int` (the decimal is thrown away)
- C) You get a `float` ✅
- D) You get a `String`

**2. In the array `var inventory: Array[String] = ["flashlight", "key"]`, what is `inventory[0]`?**
- A) `"key"`
- B) `"flashlight"` ✅
- C) `2`
- D) `null`

**3. What is a dictionary best used for?**
- A) A single true or false value
- B) A list of items in order
- C) A collection of labeled values ✅
- D) Playing a sound

**4. What should you do before using a variable that might be `null`?**
- A) Delete the variable
- B) Check it first, for example with `if monster != null:` ✅
- C) Convert it to an `int`
- D) Print it twice

<!-- quiz-answers: 1=C, 2=B, 3=C, 4=B -->

## Next up
In Lesson 3 you'll teach the game to choose a path with `if`, `elif`, `else`, and `match`, so a monster can decide whether it heard you.
