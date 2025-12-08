# Includes some references with Rule 90 (Sierpinski) and Rule 30 triangles, as well as a basic way
# to implement the font-based automota.

# TODOS
# 1) try and convert operations from int-based to bool-based, less storage and also will easier with .bdf/whatever we can make work
# 2) research and find out what file format works best to a) interact with this and b) map to a larger grid

# https://www.geeksforgeeks.org/dsa/cellular-automaton-discrete-model/
# https://en.wikipedia.org/wiki/Rule_30

# length of the string used for triangles
LENGTH = 34
T_LENGTH = 16 # max length of serif font "T" for proof of concept

# how many lines of the triangle will be generated
LINES = 15 

# All possible patterns
rules = [
    [0, 0, 0], [0, 0, 1],
    [0, 1, 0], [0, 1, 1],
    [1, 0, 0], [1, 0, 1],
    [1, 1, 0], [1, 1, 1],
]

# need to finish this later as well as bring over font stuff from C++ version
serif_T = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
]

def print_rules(rule):
    print("The rules of Rule ", rule, " Cellular Automaton are as follows: \n")

    for i in range(8): 
        if (rule == 30):
            print(f"\t\tRule {i + 1}: {rules[i]} -> sets cell to: {rules[i][0] ^ (rules[i][1] or rules[i][2])}")
        if (rule == 90):
            print(f"\t\tRule {i + 1}: {rules[i]} -> sets cell to: {rules[i][0] ^ rules[i][2]}")

def print_state(state):
    print("\t\t", end="")
    for i in range(len(state)):
        if (state[i] == 1):
            print("\u25A0", end="")
        elif (state[i] == 0):
            print(" ", end="")
    print()

def generate_triangle(rule):
    # intialize triangle and update state arrays
    triangle = [0] * LENGTH
    update_state = [0] * LENGTH

    # start with only the "top" of the triangle filled
    triangle[(LENGTH) // 2 - 1] = 1

    print_state(triangle)

    for _ in range(LINES):
        # clear update state
        update_state = [0] * LENGTH

        for j in range(1, LENGTH - 1):
            # gather values for current window
            val1, val2, val3 = triangle[j - 1], triangle[j], triangle[j + 1]

            # apply desired rule and store into the update state's array
            if (rule == 30):
                update_state[j] = val1 ^ (val2 or val3)
            elif (rule == 90):
                update_state[j] = val1 ^ val3

        # add the updated state to the next line of the triangle
        triangle = update_state.copy()

        print_state(triangle)

if __name__ == "__main__":
    print_rules(90)
    print("\n\t\t\tRULE 90 (SIERPINSKI) TRIANGLE\n\n")
    generate_triangle(90)

    print_rules(30)
    print("\n\t\t\tRULE 30 TRIANGLE\n\n")
    generate_triangle(30)

    