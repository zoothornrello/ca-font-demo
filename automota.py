# Includes some references with Rule 90 (Sierpinski) and Rule 30 triangles, as well as a basic way
# to implement the font-based automota.s

# TODO: map the font into a larger grid so cellular automota is "expansive" and not just performing operations in-place
# still looks pretty good but need to probably map it into a larger grid.
# TODO: may also need to consider reverse-mapping, where a modified font is tranformed back into a displayable PNG from a 2d array
# TODO: need to create a Makefile for downloading libraries...go back to old classwork for that!

# https://www.geeksforgeeks.org/dsa/cellular-automaton-discrete-model/
# https://en.wikipedia.org/wiki/Rule_30

import cv2

# everything from line 16 - line 86 is all just for demonstration of cellular automota so that can be removed later.

# length of the string used for triangles
LENGTH = 34

# how many lines of the triangle will be generated
LINES = 15 

# All possible patterns
rules = [
    [0, 0, 0], [0, 0, 1],
    [0, 1, 0], [0, 1, 1],
    [1, 0, 0], [1, 0, 1],
    [1, 1, 0], [1, 1, 1],
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

def print_font(font):
    for i in range(len(font)):
        print("\t\t", end="")

        for j in range(len(font[i])):
            if (font[i][j] == 1):
                print("\u25A0", end="")
            elif (font[i][j] == 0):
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

def map_png_to_2d_array(font_path):
        # https://stackoverflow.com/questions/45613544/python-opencv-cannot-change-pixel-value-of-a-picture
    img = cv2.imread(font_path)
    height, width, channels = img.shape

    # making a blank 2d array to hold out bit-map of the font
    font_map = [[0 for i in range(width)] for j in range(height)]

    for row in range(0, height):
        for col in range(0, width):
            # pixel in location is white, maps to 0 in array
            if (img[row,col,0] == 255 and img[row,col,1] == 255 and img[row,col,2] == 255):
                font_map[row][col] = 0
            # pixel in location is black, maps to 1 in array
            elif (img[row,col,0] == 0 and img[row,col,1] == 0 and img[row,col,2] == 0):
                font_map[row][col] = 1

    return font_map

# assumes that the font will be passed in as a 2-d array
def manipulate_font(steps, font, rule):
    update_state = [0] * len(font)

    for step in range(steps):
        # go through each line of the font
        print("\n\t\t\t\tSTEP #", step + 1, "\n")
        for i in range(len(font)):
            # erase old state
            update_state = [0] * len(font)

            # go through each item in the current line of the font
            for j in range(1, len(font[i]) - 1):
                val1, val2, val3 = font[i][j - 1], font[i][j], font[i][j + 1]

                # apply desired rule and store into the update state's array
                if (rule == 30):
                    update_state[j] = val1 ^ (val2 or val3)
                elif (rule == 90):
                    update_state[j] = val1 ^ val3

            # overwrite the current line with a copy of the updated state
            font[i] = update_state.copy()
            print_state(font[i])

if __name__ == "__main__":
    print_rules(90)
    print("\n\t\t\tRULE 90 (SIERPINSKI) TRIANGLE\n\n")
    generate_triangle(90)

    print_rules(30)
    print("\n\t\t\tRULE 30 TRIANGLE\n\n")
    generate_triangle(30)
    
    print("Enter rule to apply to font (30 or 90): ")
    rule = int(input())

    print("Enter number of steps to apply rule", rule, "to: ")
    steps = int(input())

    # path is currently hard-coded but will need to be changed based on user selections further down the line
    A_mapped = map_png_to_2d_array("A_Satoshi-Black.png")
    print_font(A_mapped)

    manipulate_font(steps, A_mapped, rule)
