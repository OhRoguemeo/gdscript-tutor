---
id: 01-variables
module: 1
title: "Variables: Giving Your Game a Memory"
level: beginner
estimated_minutes: 15
---

# Variables: Giving Your Game a Memory

## What is a variable?
A variable is a labeled box that holds a piece of information your game needs to remember. That could be the player's health, how scared they are, their name, or whether the flashlight is on. You give the box a name, put a value inside, and you can look at it or change it later.

In GDScript you make a variable with the word `var`, then a name, then `=` and a starting value:

```gdscript
var health = 100
```

Read it out loud as "make a box called `health` and put 100 in it."

## The four basic types
Every value has a **type**, which is the kind of information it is:

| Type | What it holds | Example |
|------|---------------|---------|
| `int` | Whole numbers | `100`, `-3`, `0` |
| `float` | Numbers with a decimal point | `0.5`, `3.14`, `9.8` |
| `String` | Text, inside quotes | `"Michael"`, `"Run!"` |
| `bool` | Just `true` or `false` | `true` |

You can tell Godot the type with a colon. This is called **static typing**. It catches mistakes early and makes your code easier to read:

```gdscript
var health: int = 100
```

Or let Godot figure out the type from the value with `:=`:

```gdscript
var health := 100   # Godot knows this is an int
```

## Code example: a horror game player
```gdscript
extends Node

# int: whole numbers
var health: int = 100
var batteries: int = 3

# float: decimal numbers
var fear_level: float = 0.0       # 0.0 = calm, 1.0 = terrified
var walk_speed: float = 4.5

# String: text
var player_name: String = "Michael"
var current_room: String = "Basement"

# bool: true or false
var flashlight_on: bool = false
var is_hiding: bool = false

func _ready() -> void:
	print(player_name, " wakes up in the ", current_room, ".")

	# Change values as things happen
	flashlight_on = true
	batteries -= 1          # same as: batteries = batteries - 1
	fear_level += 0.25

	print("Flashlight on: ", flashlight_on)
	print("Batteries left: ", batteries)
	print("Fear level: ", fear_level)
```

**Output:**
```
Michael wakes up in the Basement.
Flashlight on: true
Batteries left: 2
Fear level: 0.25
```

## Quick tips
- Names use `snake_case`: lowercase words joined by underscores, like `fear_level`.
- Names can't start with a number or contain spaces.
- Once a variable is typed as `int`, Godot won't let you put text in it. That's a good thing, because it stops bugs before they happen.
- `const` is for values that never change: `const MAX_HEALTH: int = 100`.

## Quiz

**1. What does a variable do?**
- A) Draws a 3D model on screen
- B) Stores a piece of information the game can use and change later ✅
- C) Plays a sound effect
- D) Closes the game

**2. Which type should you use for `fear_level = 0.75`?**
- A) `int`
- B) `String`
- C) `float` ✅
- D) `bool`

**3. Which line correctly makes a text variable?**
- A) `var current_room: String = Basement`
- B) `var current_room: String = "Basement"` ✅
- C) `current_room var = "Basement"`
- D) `var current_room: int = "Basement"`

**4. What can a `bool` variable hold?**
- A) Any number
- B) Only `true` or `false` ✅
- C) A list of words
- D) Only decimal numbers

<!-- quiz-answers: 1=B, 2=C, 3=B, 4=B -->

## Next up
In Lesson 2 you'll dig into data types, including what happens when you mix them, like adding an `int` and a `float`.
