#!/usr/bin/env python3
"""Builds app/assets/curriculum.json from the curriculum text below, the rendered images in
app/refs/ and the museum picks in tools/museum.json.

Run from the project folder:  python3 tools/build_curriculum.py
"""
import html, json, os, re, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REFS = os.path.join(ROOT, 'app', 'refs')
OUT = os.path.join(ROOT, 'app', 'assets', 'curriculum.json')
PAGE = os.path.join(ROOT, 'app', 'curriculum', 'index.html')


def webp_size(path):
    with open(path, 'rb') as f:
        d = f.read(40)
    if d[12:16] == b'VP8 ':
        w, h = struct.unpack('<HH', d[26:30]); return w & 0x3fff, h & 0x3fff
    if d[12:16] == b'VP8L':
        b = d[21:25]; v = int.from_bytes(b, 'little'); return (v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1
    if d[12:16] == b'VP8X':
        return int.from_bytes(d[24:27], 'little') + 1, int.from_bytes(d[27:30], 'little') + 1
    raise ValueError(path)


# ------------------------------------------------------------------ reference sets
LOCAL = {
    'fig-gesture': 'Mannequin poses',
    'fig-foreshort': 'Mannequin from high and low',
    'head-lines': 'Head forms with construction lines',
    'head-forms': 'Head forms, turned and tilted',
    'head-light': 'Head forms in strong light',
    'forms-light': 'Simple forms in one light',
    'still-life': 'Still lifes in light, middle and dark',
    'persp-boxes': 'Boxes in one, two and three point',
    'persp-cyl': 'Cylinders and ellipses',
    'persp-scenes': 'Rooms and streets',
    'color-forms': 'Colored forms in warm and cool light',
}
MUSEUM = {
    'm-figures': ('figures', 'Master figure drawings'),
    'm-heads': ('heads', 'Master heads and portraits'),
    'm-values': ('values', 'Master value drawings'),
    'm-color': ('color', 'Still lifes and interiors in color'),
    'm-landscape': ('landscape', 'Landscapes and seascapes'),
    'm-composition': ('composition', 'Scenes with people'),
    'm-animals': ('animals', 'Animals'),
}

# ------------------------------------------------------------------ curriculum
def S(set_, plan, title, how, **kw):
    return dict(t='session', set=set_, plan=plan, title=title, how=how, **kw)
def B(board, plan, title, how, **kw):
    return dict(t='board', board=board, plan=plan, title=title, how=how, **kw)
def STUDY(set_, mins, title, how):
    return dict(t='study', set=set_, min=mins, title=title, how=how)
def STUDIO(set_, mins, title, how, **kw):
    return dict(t='studio', set=set_, min=mins, title=title, how=how, **kw)
def FREE(mins, title, how, **kw):
    return dict(t='free', min=mins, title=title, how=how, **kw)

TRACKS = [
  dict(id='figure', name='Figure', blurb='Movement, structure and proportion of the whole body.', units=[
    dict(id='fig-1', title='Gesture', goal='Catch the movement of a pose before any detail. A gesture is a few lines that show where the weight goes and how the body bends.',
         look=['One long line from the head through the body to the foot that carries the weight', 'Shoulders and hips usually tilt in opposite directions', 'When the time is up, stop, even mid-line'],
         ex=[S('fig-gesture', [[20, 30]], '20 poses, 30 seconds each', 'Only the line of action and the tilt of shoulders and hips.'),
             S('fig-gesture', [[10, 60]], '10 poses, 1 minute each', 'Add the head and the limbs as single lines.'),
             S('fig-gesture', [[5, 120]], '5 poses, 2 minutes each', 'Put the rib cage and pelvis on top of the gesture as two simple masses.')]),
    dict(id='fig-2', title='Structure', goal='Turn the gesture into simple forms that sit in space: boxes for the chest and pelvis, cylinders for the limbs.',
         look=['Draw through the forms, including the edges you can\'t see', 'Where one form overlaps another, show it with the line', 'Ellipses at the joints show which way a limb points'],
         ex=[S('fig-gesture', [[8, 120]], '8 poses, 2 minutes each', 'Chest and pelvis as boxes. Show how they tilt and turn against each other.'),
             S('fig-foreshort', [[6, 180]], '6 views from above and below, 3 minutes each', 'Limbs as cylinders. Overlaps tell what\'s in front.'),
             FREE(15, 'Five poses from memory', 'Without a reference, draw five mannequin poses you remember from today.')]),
    dict(id='fig-3', title='Proportion', goal='Measure and check. Compare lengths against the head and the torso, then check your drawing on top of the reference.',
         look=['Find the halfway point of the figure: usually around the hips', 'Compare one length with another before you commit', 'Look at the negative shapes between arms and body'],
         ex=[STUDIO('fig-gesture', 15, 'Draw one pose, then compare', 'Draw a pose for 15 minutes, photograph it and lay it over the reference in Compare.'),
             S('fig-foreshort', [[4, 300]], '4 foreshortened poses, 5 minutes each', 'Measure with your pencil at arm\'s length.'),
             STUDIO('fig-foreshort', 20, 'A foreshortened pose, checked', 'Draw for 20 minutes, then check the proportions in Compare.')]),
    dict(id='fig-4', title='Master figure drawings', goal='Copy drawings by artists who solved these problems before you, and notice their choices.',
         look=['Where did the artist simplify, and where did they add detail?', 'Which lines are dark and which are light?', 'Copy the proportions first, the shading last'],
         ex=[S('m-figures', [[6, 120]], '6 drawings, 2 minutes each', 'A quick gesture over each master drawing.'),
             STUDY('m-figures', 30, 'One copy, 30 minutes', 'Pick one drawing and copy it carefully.'),
             STUDIO('m-figures', 30, 'Copy and compare', 'Copy a drawing for 30 minutes, then lay your copy over it in Compare.')]),
  ]),
  dict(id='heads', name='Heads', blurb='The head as a form you can turn in any direction, then light and likeness.', units=[
    dict(id='head-1', title='Ball and plane', goal='Build the head from a ball with flat sides and a jaw. The construction lines show which way the head faces.',
         look=['The center line shows the turn; the brow line shows the tilt', 'The side of the head is flat, like a slice cut off a ball', 'The face divides into thirds: hairline to brow, brow to nose, nose to chin'],
         ex=[S('head-lines', [[10, 60]], '10 heads, 1 minute each', 'Only the ball, the side plane and the center line.'),
             S('head-lines', [[6, 180]], '6 heads, 3 minutes each', 'Add the brow line, the jaw and the thirds of the face.'),
             FREE(15, 'Ten heads from imagination', 'Draw the ball and plane head in ten different directions without a reference.')]),
    dict(id='head-2', title='Tilts and turns', goal='Read the angle of a head at a glance, without construction lines to help.',
         look=['Find the center line of the face first', 'A head tilted up shows more of the jaw; tilted down, more of the top', 'The far eye and cheek get narrower as the head turns'],
         ex=[S('head-forms', [[15, 30]], '15 heads, 30 seconds each', 'Only the center line and the brow line.'),
             S('head-forms', [[8, 120]], '8 heads, 2 minutes each', 'Full construction on each head.'),
             STUDIO('head-forms', 15, 'One head, checked', 'Draw one head for 15 minutes, then check it in Compare.')]),
    dict(id='head-3', title='Light on the head', goal='See the head as light and shadow shapes. Group the shadows into one flat tone first.',
         look=['Find the line where light turns into shadow', 'Keep everything in shadow one value until the end', 'The eye sockets and under the nose are the first places to go dark'],
         ex=[S('head-light', [[6, 180]], '6 heads, 3 minutes each', 'Fill the shadow shape with one flat tone.', gray=True),
             STUDIO('head-light', 20, 'Three values, then draw', 'In the Studio set Values to 3, study the shapes, then draw for 20 minutes.', values=3),
             STUDY('head-light', 25, 'One lit head, 25 minutes', 'A full value study of one head.')]),
    dict(id='head-4', title='Portrait studies', goal='Use what you know about the form of the head on real faces by master artists.',
         look=['Construction first, features last', 'Features sit on the form; they turn with it', 'Look for the big shadow shapes before the details'],
         ex=[S('m-heads', [[8, 120]], '8 heads, 2 minutes each', 'Ball, plane and the thirds on each one.'),
             STUDY('m-heads', 30, 'One copy, 30 minutes', 'Copy a head carefully.'),
             STUDIO('m-heads', 30, 'Copy and compare', 'Copy a head, then check it in Compare.')]),
  ]),
  dict(id='perspective', name='Perspective', blurb='Draw things so they sit convincingly in space.', units=[
    dict(id='per-1', title='Boxes', goal='Find the horizon and the vanishing points, then draw boxes through, including the hidden edges.',
         look=['The horizon is at your eye level', 'Parallel edges meet at the same vanishing point', 'Vertical edges stay vertical in one and two point'],
         ex=[S('persp-boxes', [[12, 60]], '12 scenes, 1 minute each', 'Mark the horizon and vanishing points only.'),
             S('persp-boxes', [[6, 180]], '6 scenes, 3 minutes each', 'Draw each box through, with the hidden edges.'),
             FREE(20, 'A page of boxes', 'Fill a page with boxes from imagination in two point perspective.'),
             FREE(20, 'Boxes along a path', 'Turned boxes from imagination, each one started with a Y.',
                  steps=['Draw a long, swooping path across the page, moving your whole arm.',
                         'Start each box with a Y: three edges coming out of the nearest corner. Keep every angle of the Y wider than a right angle.',
                         'Put a small dot where each edge should end, ghost the line a few times, then draw it in one stroke.',
                         'At each back corner, look at all the edges that meet there and choose a point that suits them all. Then connect the dots.',
                         'Make the boxes smaller as the path goes away from you. Keep their depth gentle: very stretched boxes are hard to judge.'])]),
    dict(id='per-2', title='Cylinders and ellipses', goal='Draw round forms in space. Ellipses get rounder the further they are from your eye level.',
         look=['The short axis of an ellipse follows the center line of the cylinder', 'Ellipses near the horizon are thin', 'Ellipses have no points at the ends'],
         ex=[S('persp-cyl', [[10, 60]], '10 scenes, 1 minute each', 'Center lines and ellipses only.'),
             S('persp-cyl', [[6, 180]], '6 scenes, 3 minutes each', 'Full cylinders, drawn through.'),
             FREE(15, 'Ellipse drill', 'Three rows of ellipses, each row thinner. Draw from the shoulder.')]),
    dict(id='per-3', title='Rooms and streets', goal='Put whole spaces together: walls, floors and objects that share the same vanishing points.',
         look=['Start with the horizon and the biggest planes', 'Doors and windows share the wall\'s vanishing point', 'Repeat elements get smaller toward the vanishing point'],
         ex=[S('persp-scenes', [[6, 120]], '6 scenes, 2 minutes each', 'Horizon, vanishing points and the biggest planes.'),
             S('persp-scenes', [[3, 600]], '3 scenes, 10 minutes each', 'A full line drawing of each space.'),
             STUDIO('persp-scenes', 20, 'One scene, checked', 'Draw a scene for 20 minutes, then check it in Compare.')]),
    dict(id='per-4', title='Real places', goal='Find perspective in real streets, where nothing is perfectly lined up.',
         look=['Find the horizon first, even if it\'s hidden behind buildings', 'Not every building faces the same way', 'Simplify: big boxes first, windows last'],
         ex=[B('places', [[6, 120]], '6 places, 2 minutes each', 'Horizon and the main boxes of each street. Uses your Places board.'),
             B('places', [[2, 900]], '2 places, 15 minutes each', 'A full drawing of one street.'),
             FREE(30, 'Invent a street', 'Use what you drew to design a street of your own.')]),
  ]),
  dict(id='value', name='Light & value', blurb='How light falls on form, and how to group what you see into a few values.', units=[
    dict(id='val-1', title='Light on simple forms', goal='Learn the parts of light and shadow on simple forms you can see clearly.',
         look=['Light, core shadow, reflected light and cast shadow', 'The core shadow is where the form turns away from the light', 'Cast shadows are darkest where they touch the object'],
         ex=[S('forms-light', [[10, 60]], '10 forms, 1 minute each', 'Draw only the shape of the shadow.'),
             S('forms-light', [[6, 300]], '6 forms, 5 minutes each', 'Show light, core shadow, reflected light and cast shadow.')]),
    dict(id='val-2', title='Three values', goal='Simplify what you see into three values: light, middle and dark.',
         look=['Squint to see the big shapes', 'A dark object in light can be the same value as a light object in shadow', 'Decide the value groups before you draw'],
         ex=[STUDIO('still-life', 15, 'Three values in the Studio', 'Set Values to 3, study the shapes, then draw them flat.', values=3),
             S('still-life', [[6, 180]], '6 still lifes, 3 minutes each', 'Three flat values, no blending.', gray=True),
             S('m-values', [[6, 180]], '6 master drawings, 3 minutes each', 'Find the three value groups in each one.')]),
    dict(id='val-3', title='Full range', goal='Go from three values to a full range, while keeping the big groups intact.',
         look=['Lay in the three groups first', 'Add variation inside each group, not across them', 'Keep the lightest lights and darkest darks small'],
         ex=[STUDY('still-life', 30, 'One still life, 30 minutes', 'A full value drawing.'),
             STUDY('m-values', 30, 'One master copy, 30 minutes', 'Copy a value drawing.'),
             STUDIO('still-life', 30, 'Draw, then compare', 'A 30-minute value drawing, checked in Compare with Pencil view.')]),
    dict(id='val-4', title='Master value studies', goal='Copy masters of tone and see how few values they really used.',
         look=['Count the values: often there are fewer than you think', 'Notice where edges are soft and where they\'re hard', 'Squint at your copy and the original side by side'],
         ex=[STUDY('m-values', 45, 'One copy, 45 minutes', 'A careful copy of a value drawing.'),
             STUDIO('m-values', 45, 'Copy and compare', 'Copy for 45 minutes, then lay your copy over it.')]),
  ]),
  dict(id='color', name='Color & light', blurb='Color temperature, value in color, and color from the masters.', units=[
    dict(id='col-1', title='Warm light, cool shadow', goal='See color temperature: warm light usually comes with cool shadows, and the other way round.',
         look=['Compare the light side and the shadow side of the same object', 'Cast shadows pick up color from the sky or the room', 'Keep the values right even when the color changes'],
         ex=[S('color-forms', [[6, 300]], '6 scenes, 5 minutes each', 'Two colors only: one for the light, one for the shadow.'),
             STUDY('color-forms', 20, 'One scene, 20 minutes', 'A full color study.'),
             STUDIO('color-forms', 15, 'Find warm and cool', 'In the color wheel, click the warm slices, then the cool ones, to see where each sits. Then paint a two-color study.', colors=True)]),
    dict(id='col-2', title='Value first', goal='Color works when the values work. Check every color study in grayscale.',
         look=['A bright color can be a dark value', 'Press G in the viewer to check values while you paint', 'If the gray version reads, the color version will too'],
         ex=[S('m-color', [[6, 180]], '6 paintings, 3 minutes each', 'A grayscale study of each one first.', gray=True),
             STUDY('m-color', 20, 'Same painting in color', 'Paint one in color, then compare both in grayscale.')]),
    dict(id='col-3', title='Landscape color', goal='Use the light of the sky and the air between you and the distance.',
         look=['Distant things get lighter, cooler and less contrasty', 'The sky is usually the lightest value', 'Shadows in daylight are often blue'],
         ex=[S('m-landscape', [[6, 300]], '6 landscapes, 5 minutes each', 'Small color studies of the big shapes.'),
             STUDY('m-landscape', 30, 'One landscape, 30 minutes', 'A color copy.')]),
    dict(id='col-4', title='Master color copies', goal='Copy a painting to learn how its colors were mixed and placed.',
         look=['Start with the big color shapes', 'Compare each color with its neighbors, not with the tube', 'Notice which colors repeat across the picture'],
         ex=[STUDY('m-color', 45, 'One copy, 45 minutes', 'A color copy of a still life or interior.'),
             STUDIO('m-landscape', 45, 'Copy and compare', 'Copy a landscape, then check it in Compare.'),
             STUDIO('m-color', 30, 'Find the scheme first', 'Read the painting in the color wheel: name its scheme and its two main hues. Then copy it using mainly those.', colors=True)]),
  ]),
  dict(id='composition', name='Composition', blurb='Arranging shapes and values into pictures.', units=[
    dict(id='com-1', title='Thumbnails', goal='Small, quick drawings of a whole picture: the arrangement of big shapes, not the details.',
         look=['Draw the frame first, small', 'Three to five shapes are enough', 'Notice where your eye goes first'],
         ex=[S('m-composition', [[10, 120]], '10 paintings, 2 minutes each', 'A thumbnail of the big shapes.'),
             S('m-composition', [[5, 300]], '5 paintings, 5 minutes each', 'Thumbnails with three values.')]),
    dict(id='com-2', title='Light and dark pattern', goal='Reduce a picture to two values to see its pattern of light and dark.',
         look=['Every shape is either light or dark', 'Strong pictures read at the size of a stamp', 'Connected darks make bigger, simpler shapes'],
         ex=[STUDIO('m-composition', 10, 'Two values in the Studio', 'Set Values to 2, then thumbnail the pattern.', values=2),
             S('m-landscape', [[8, 120]], '8 landscapes, 2 minutes each', 'Two-value thumbnails.', gray=True)]),
    dict(id='com-3', title='Find the crop', goal='The same scene can make very different pictures. Try crops and guides to find the strongest one.',
         look=['Try a tall and a wide crop of the same scene', 'Place the main shapes on a guide, then break the rule and compare', 'Leave room in the direction things face or move'],
         ex=[STUDIO('m-landscape', 20, 'Three crops, one drawing', 'Try three crops with different guides, fix the best one and draw it.'),
             STUDIO('m-composition', 20, 'Recompose a painting', 'Find a new picture inside a painting and draw it.')]),
    dict(id='com-4', title='Film frames', goal='Film directors compose every frame. Study how they place people, light and depth.',
         look=['Where is the main subject in the frame?', 'How do lines in the set lead your eye?', 'What is in the dark?'],
         ex=[B('film', [[8, 120]], '8 frames, 2 minutes each', 'Thumbnails of film frames. Uses your Film scenes board.'),
             FREE(30, 'Design your own frame', 'Three thumbnails of a scene of your own, then one finished drawing.')]),
  ]),
  dict(id='animals', name='Animals', blurb='Gesture and structure of animals.', units=[
    dict(id='ani-1', title='Animal gesture', goal='Catch the movement of an animal the same way as a person: line of action first.',
         look=['Find the spine first', 'Four legs: notice which carry the weight', 'Heads are often lower than you think'],
         ex=[S('m-animals', [[15, 45]], '15 animals, 45 seconds each', 'Spine and legs only.'),
             S('m-animals', [[8, 90]], '8 animals, 90 seconds each', 'Add the rib cage, pelvis and head as masses.')]),
    dict(id='ani-2', title='Animal structure', goal='Build animals from simple forms: a rib cage, a pelvis, and the bend of the legs.',
         look=['Many animals walk on their toes', 'The rib cage is deep and narrow', 'Leg joints bend in alternating directions'],
         ex=[S('m-animals', [[6, 300]], '6 animals, 5 minutes each', 'Structure with simple forms.'),
             FREE(20, 'Animals from memory', 'Draw three animals from memory, then check them against the references.')]),
    dict(id='ani-3', title='Animal studies', goal='Longer studies from masters of animal drawing.',
         look=['Fur follows the form underneath', 'Squint to find the big value groups', 'Keep the gesture alive in long drawings'],
         ex=[STUDY('m-animals', 30, 'One study, 30 minutes', 'A careful copy.'),
             STUDIO('m-animals', 30, 'Copy and compare', 'Copy, then check it in Compare.')]),
  ]),
  dict(id='environments', name='Environments', blurb='Landscapes and places: big shapes, depth and atmosphere.', units=[
    dict(id='env-1', title='Big shapes', goal='Split a landscape into foreground, middle ground and background before anything else.',
         look=['Three planes, three values', 'Overlapping shapes create depth', 'Simplify trees and hills into flat shapes'],
         ex=[S('m-landscape', [[8, 180]], '8 landscapes, 3 minutes each', 'Foreground, middle ground and background as flat shapes.')]),
    dict(id='env-2', title='Atmosphere', goal='Show distance with value and contrast: things fade as they get further away.',
         look=['Darks get lighter in the distance', 'Contrast is strongest up close', 'Edges soften with distance'],
         ex=[S('m-landscape', [[6, 300]], '6 landscapes, 5 minutes each', 'Value studies that show depth.', gray=True),
             STUDY('m-landscape', 30, 'One landscape, 30 minutes', 'A value study of one landscape.')]),
    dict(id='env-3', title='Your own scene', goal='Combine perspective, value and composition in a place of your own.',
         look=['Start from a real place, then change it', 'Decide the light before you draw', 'Thumbnail before the final drawing'],
         ex=[B('places', [[4, 300]], '4 places, 5 minutes each', 'Studies of real streets. Uses your Places board.'),
             FREE(45, 'Design a scene', 'Three thumbnails, then a finished drawing of a scene from imagination.')]),
  ]),
]

# The lesson text for each unit page: why the unit matters, how to do it, common mistakes and
# what to expect. Units that use a method from Drawabox (drawabox.com) credit and link it; the
# text here is our own.
def G(why, steps, mistakes, expect, credit=None):
    g = dict(why=why, steps=steps, mistakes=mistakes, expect=expect)
    if credit: g['credit'] = [dict(label=l, url=u) for l, u in credit]
    return g

GUIDE = {
  'fig-1': G('Gesture is the base of every figure drawing. If the movement is right, the drawing feels alive even with wrong details. If it\'s stiff, no detail can save it.',
             ['Look at the whole pose for a few seconds before you draw.',
              'Draw one long, curved line from the head to the foot that carries the weight.',
              'Add the tilt of the shoulders and the hips as two short lines.',
              'Add the head and the limbs as single lines that follow the curve.',
              'When the time is up, stop and move to the next pose.'],
             ['Starting with the outline of the body instead of the movement',
              'Many short, hairy strokes instead of one confident line',
              'Making the pose straighter and stiffer than it is'],
             'Your first gestures will look like scribbles, and that\'s fine. You\'re training your eye to see movement fast, not making finished drawings.'),
  'fig-2': G('A gesture is flat. Boxes and cylinders give the figure a front, sides and a back, so it sits in space and you can turn it any way you like.',
             ['Start with a quick gesture.',
              'Put the rib cage and the pelvis on it as two boxes. Show how they tilt and twist against each other.',
              'Draw the arms and legs as cylinders that follow the gesture.',
              'Add ellipses at the joints to show which way each limb points.',
              'Draw through: include the edges you can\'t see.'],
             ['Losing the movement once the boxes go on top',
              'Boxes and cylinders that all face you flat on',
              'No overlaps, so it\'s unclear which limb is in front'],
             'Boxes on a body feel awkward at first, and many will look wrong. Keep drawing them through: the feeling for space comes with repetition.'),
  'fig-3': G('Proportion makes a figure believable. Measuring trains your eye to compare sizes, and checking against the reference shows where your eye still fools you.',
             ['Lightly block in the gesture and the big masses.',
              'Choose one length, such as the head, and compare other lengths with it.',
              'Check the halfway point of the figure and the negative shapes between the limbs.',
              'Correct the drawing before you add any detail.',
              'In Compare, lay your drawing over the reference and find the biggest difference.'],
             ['Measuring small parts before the big shapes are right',
              'Making the head too big',
              'Finding a mistake in Compare and not looking for it in the next drawing'],
             'Compare will show mistakes in every drawing, even good ones. The point is to find the one you make most often and watch for it next time.'),
  'fig-4': G('Master drawings show how other artists solved the problems you\'ve been working on. Copying them slowly makes you notice choices you\'d miss by just looking.',
             ['Look at the drawing for a minute first. Where does the movement go?',
              'Copy the gesture and the big proportions.',
              'Then the forms, then which lines the artist made dark and which light.',
              'Leave shading to the end and keep it simple.',
              'Name one thing the artist did that you want to try yourself.'],
             ['Copying line by line from the top down, so the proportions drift',
              'Copying the marks without asking why they\'re there',
              'Trying to match every detail in a short time'],
             'Your copy won\'t look like the original, and it doesn\'t need to. You learn from what you notice, not from how close the copy gets.'),

  'head-1': G('A face is hard to draw as a flat list of features. If you build the head as a simple form first, the features have somewhere to sit, at any angle.',
              ['Draw a ball for the skull.',
               'Cut a flat oval off the side of the ball. This is the side of the head.',
               'Draw the center line down the front to show which way the head faces.',
               'Add the brow line across it, then the jaw and the chin.',
               'Divide the face into thirds: hairline to brow, brow to nose, nose to chin.'],
              ['A flat circle with features drawn on top',
               'A center line that doesn\'t curve around the ball',
               'The side plane in the same place on every head, whatever the turn'],
              'Your heads will look like odd robots for a while. That\'s the method working: likeness comes much later, once the form is right.'),
  'head-2': G('The angle of the head decides where the features go and how much of each you see. Reading it quickly makes every later head easier.',
              ['Find the center line of the face first.',
               'Find the brow line and how it tilts.',
               'Check how much of the far side you can see. That tells you how far the head is turned.',
               'Build the rest of the head on these two lines.'],
              ['Drawing every head straight on, out of habit',
               'Both eyes the same width when the head is turned',
               'Forgetting that the ears move down when the head tilts up'],
              'Some heads will be hard to read in 30 seconds. Guess, commit to a line and move on: quick guesses improve faster than slow ones.'),
  'head-3': G('Light shows form. Seeing the head as a few shadow shapes is faster and looks more solid than shading each feature on its own.',
              ['Lightly construct the head.',
               'Find the line where the light turns into shadow.',
               'Fill everything in shadow with one flat tone.',
               'Only then add the darkest accents, such as the eye sockets and under the nose.',
               'Keep the light side simple.'],
              ['Shading each feature separately, so the shadow shape breaks up',
               'Light inside the shadow that\'s as bright as the light side',
               'Detail on the light side that breaks up the form'],
              'One flat shadow shape will feel too simple at first. Trust it: the head will look more solid, not less.'),
  'head-4': G('Real faces differ a lot from the simple model. Master portraits show how artists kept the form of the head while drawing a real person.',
              ['Find the angle of the head and draw the construction.',
               'Place the features on the form so they turn with it.',
               'Group the shadows into big shapes.',
               'Add detail last, and only where the artist did.'],
              ['Starting with one eye and working outward',
               'Features drawn flat on a head that\'s turned',
               'Losing the big shadow shapes in small details'],
              'Likeness is hard and comes late. If the head looks solid and turns the right way, the study worked.'),

  'per-1': G('A box is the simplest form with clear sides, and almost anything can be built from boxes. Drawing them trains you to feel space on a flat page.',
             ['Mark the horizon at your eye level.',
              'Place the vanishing points on the horizon.',
              'Ghost each line first: move your arm over the page a few times without touching it, then draw the line in one stroke.',
              'Draw every edge, including the hidden ones at the back.',
              'Check your box: edges that are parallel should head to the same vanishing point.'],
             ['Slow, wobbly lines from drawing too carefully',
              'Back edges that don\'t head to the same point as the front ones',
              'Going over a wrong line again and again instead of moving on'],
             'Many of your boxes will be wrong, and you\'ll be able to see it. That\'s the exercise working: seeing the mistake is the skill you\'re building.',
             credit=[('The Y method', 'https://drawabox.com/lesson/1/organicperspective/ymethod'),
                     ('Lesson 1: lines, ellipses and boxes', 'https://drawabox.com/lesson/1')]),
  'per-2': G('Round forms are everywhere: limbs, cups, wheels, trees. An ellipse shows which way a round form faces, so good ellipses make forms turn in space.',
             ['Draw the center line of the cylinder first.',
              'Draw the ellipses across it, with their short axis on the center line.',
              'Draw each ellipse from your shoulder, going around it two or three times in one movement.',
              'Make the ellipse that\'s further from your eye level a little rounder.',
              'Join the ellipses with the sides of the cylinder.'],
             ['Pointed ends on the ellipses',
              'Ellipses tilted away from the center line',
              'Drawing from the wrist, so the curves go flat on one side'],
             'Ellipses take a long time to get even. Wobbly ones on your first pages are normal: keep drawing them from the shoulder anyway.',
             credit=[('Ellipses', 'https://drawabox.com/lesson/1/5'),
                     ('Drawing from the shoulder', 'https://drawabox.com/lesson/1/2')]),
  'per-3': G('A scene works when everything in it shares the same space. This unit puts boxes together into rooms and streets with one horizon.',
             ['Find the horizon and place the vanishing points.',
              'Block in the biggest planes: the floor, the walls, the street.',
              'Add large objects as boxes that sit on those planes.',
              'Put doors and windows on their wall, aimed at the wall\'s vanishing point.',
              'Add small details last.'],
             ['Starting with details, so the big planes never line up',
              'Objects that float because they don\'t sit on the floor',
              'Objects drawn with a different horizon from the room'],
             'A whole scene has many lines that can go wrong. If the horizon and the big planes are right, you\'ve done the important part.'),
  'per-4': G('Real streets are messier than diagrams. Finding the perspective in a real place is what lets you draw from photos and on location.',
             ['Find the horizon, even if buildings hide it.',
              'Find the main boxes: the buildings, the street, big objects.',
              'Notice buildings that face a different way. They get their own vanishing points.',
              'Add windows and doors last.'],
             ['Assuming everything faces the same way',
              'Drawing every window before the main boxes are right',
              'A horizon that doesn\'t match the eye level of the photo'],
             'Real places rarely line up perfectly, so your drawings won\'t either. Aim for a street that feels right, not one that\'s exact.'),

  'val-1': G('Light follows simple rules. Learning them on spheres, cubes and cylinders makes them easy to see later on heads and figures.',
             ['Find where the light comes from.',
              'Draw the shape of the shadow on the form, and the cast shadow on the ground.',
              'Find the core shadow: the darkest band, where the form turns away from the light.',
              'Add reflected light inside the shadow, but keep it darker than the light side.'],
             ['Reflected light as bright as the light side',
              'A cast shadow that doesn\'t follow the direction of the light',
              'Blending everything smooth before the shapes are right'],
             'Your first shadows will look flat or messy. Look for the shapes: smooth tone comes later.'),
  'val-2': G('Three values are enough to show light and form. Grouping what you see into a few values makes a drawing read clearly from across a room.',
             ['Squint until the small details disappear.',
              'Decide which shapes are light, which are middle and which are dark.',
              'Draw the outlines of the value shapes.',
              'Fill each group with one flat value. No blending.'],
             ['Too many values, so the groups break up',
              'Following the color of objects instead of the light',
              'Blending before the groups are clear'],
             'Flat values look crude at first, and that\'s what the exercise asks for. Clear groups are the base for everything after.'),
  'val-3': G('Once the big groups work, a full range of values adds form and texture without losing clarity.',
             ['Lay in the three value groups.',
              'Add variation inside each group, but keep it within the group\'s range.',
              'Keep the darkest darks and lightest lights for small accents.',
              'Squint often to check the groups still read.'],
             ['Lights in the shadow as bright as the light side',
              'The darkest dark used everywhere',
              'Losing the big groups in detail'],
             'Long value drawings test your patience. If you lose the groups, squint, go back to three values and build up again.'),
  'val-4': G('Masters often used fewer values than you\'d expect. Copying them shows how much you can leave out.',
             ['Squint at the original and count its main values.',
              'Block in the big value shapes.',
              'Notice where the edges are soft and where they\'re hard.',
              'Build up the range, checking your copy against the original as you go.'],
             ['Copying details before the values',
              'Every edge equally sharp',
              'Going darker than the original everywhere'],
             'A long copy can feel slow. Stopping to compare is part of the work, not a break from it.'),

  'col-1': G('Color temperature makes light feel real. Seeing warm and cool next to each other is the first step to painting light, not just objects.',
             ['Find the light source and decide its color.',
              'Mix one color for the light side.',
              'Mix one color for the shadow side: cooler if the light is warm, warmer if it\'s cool.',
              'Check that both still have the right value.'],
             ['A shadow that\'s just a darker version of the light color',
              'Changing the value when you only meant to change the temperature',
              'Too many colors in a short study'],
             'Warm and cool are hard to see at first. Keep comparing one area with another, and the difference will start to stand out.'),
  'col-2': G('Color only works when the values work. Checking in grayscale shows whether a painting will hold together.',
             ['Make a grayscale study first.',
              'Paint the color version with the same values.',
              'Press G in the viewer to see the reference in gray, and take a black and white photo of your painting to compare.',
              'Fix values that are off before you change any colors.'],
             ['Bright colors painted too light',
              'Changing the color when the value is the problem',
              'Skipping the gray study to save time'],
             'Your color studies may look dull next to the original. Get the values right first: richer color comes after.'),
  'col-3': G('The air between you and the distance changes colors. Showing that is how a landscape gets depth.',
             ['Decide the value of the sky first.',
              'Paint far shapes lighter, cooler and with less contrast.',
              'Paint near shapes with stronger color and contrast.',
              'Remember that shadows in daylight often pick up blue from the sky.'],
             ['Distant hills as dark and strong as near ones',
              'A sky darker than the land in a daylight scene',
              'Too many small shapes in the distance'],
             'Small studies can feel rushed. Aim for the big color shapes, not a finished picture.'),
  'col-4': G('Copying a painting slowly shows how its colors were mixed and placed, which is hard to see by just looking.',
             ['Block in the big color shapes.',
              'Compare each color with its neighbors.',
              'Notice which colors repeat across the picture.',
              'Refine edges and details last.'],
             ['Using colors straight from the tube',
              'Finishing one area before the rest is blocked in',
              'Matching a color but getting its value wrong'],
             'Your mixes won\'t match on the first try. Each wrong mix teaches you something about the paints you have.'),

  'com-1': G('A thumbnail lets you try out a whole picture in a minute or two. Big problems show up early, before you spend hours on a drawing.',
             ['Draw a small frame, about the size of a playing card.',
              'Place the three to five biggest shapes.',
              'Notice where your eye goes first.',
              'Move on. Don\'t add detail.'],
             ['Drawing too big, so thumbnails turn into drawings',
              'Adding detail before the big shapes work',
              'Forgetting to draw the frame'],
             'Thumbnails look like nothing to anyone else. They\'re for you: a quick test, not a picture.'),
  'com-2': G('A picture that reads in two values reads from across a room. The pattern of light and dark is often what makes a picture strong.',
             ['Squint at the picture.',
              'Decide for every shape: light or dark.',
              'Join darks that touch into bigger shapes.',
              'Fill the darks flat.'],
             ['Keeping a middle value because you can\'t decide',
              'Breaking big darks into many small pieces',
              'Following outlines instead of the pattern of values'],
             'Some shapes are hard to call light or dark. Choose one and move on: deciding is the skill.'),
  'com-3': G('The same scene can make many different pictures. Trying crops trains you to choose, not just copy what\'s in front of you.',
             ['Try a tall crop and a wide crop of the same scene.',
              'Place the main shapes on a guide, such as thirds.',
              'Try one crop that breaks the guide and compare.',
              'Choose the strongest and draw it.'],
             ['Keeping the first crop you tried',
              'Putting everything in the center out of habit',
              'Cutting a shape off at an awkward place'],
             'The best crop is rarely the first one. Trying weak crops is how you find the strong one.'),
  'com-4': G('Film directors compose every frame with care. Studying frames shows how placement, light and depth lead the eye.',
             ['Find the main subject in the frame.',
              'Draw the big shapes of the frame and where the subject sits.',
              'Find the lines in the set that lead to the subject.',
              'Notice what\'s in the light and what\'s in the dark.'],
             ['Drawing the actors in detail and losing the frame',
              'Ignoring the lines of the set',
              'Leaving out the darks'],
             'Some frames are busy. Stick to the big shapes: detail isn\'t the point here.'),

  'ani-1': G('Animals rarely hold still, so catching their movement quickly is the most useful animal drawing skill.',
             ['Find the spine first: one curved line.',
              'Add the head and where the feet touch the ground.',
              'Notice which legs carry the weight.',
              'Add the rib cage and the pelvis as two masses.'],
             ['Drawing the outline of the fur instead of the body',
              'All the legs straight and the same length',
              'A stiff, straight spine'],
             'Animals look strange at first because their bodies aren\'t built like ours. Keep looking: the patterns appear after a few pages.'),
  'ani-2': G('Knowing the forms under an animal lets you draw it from any angle, even without a reference.',
             ['Start with the gesture and the spine.',
              'Place the rib cage as a deep, narrow form.',
              'Add the pelvis and the shoulders.',
              'Build the legs, noticing where each joint bends.'],
             ['Taking the heel for a knee, so the leg bends the wrong way',
              'A rib cage that\'s too round and shallow',
              'Losing the gesture under the forms'],
             'Animal anatomy is confusing at first. Every animal you draw makes the next one easier.'),
  'ani-3': G('Masters of animal drawing show how to keep life in a long drawing. Copying them teaches you form and texture together.',
             ['Find the gesture first.',
              'Build the forms.',
              'Group the values.',
              'Add fur and texture last, following the form underneath.'],
             ['Drawing every hair',
              'Fur that ignores the form underneath',
              'Losing the gesture in a long study'],
             'Long studies can lose their life. If yours feels stiff, step back and draw the gesture again on top.'),

  'env-1': G('A landscape with clear planes reads at a glance. Splitting a scene into foreground, middle ground and background is the base for depth.',
             ['Find the three planes.',
              'Draw each one as a flat shape.',
              'Give each plane its own value.',
              'Check the overlaps: near shapes cover far ones.'],
             ['Drawing single trees and leaves',
              'All three planes the same value',
              'No overlaps, so everything looks flat'],
             'Flat shapes can feel too simple for a landscape. That simplicity is what makes the picture read.'),
  'env-2': G('The air between you and the distance makes things lighter and softer. Showing that gives a landscape real depth.',
             ['Start with the big planes.',
              'Make the far planes lighter, with less contrast.',
              'Keep the strongest darks and contrast up close.',
              'Soften the edges in the distance.'],
             ['Dark, sharp shapes in the distance',
              'Too much detail far away',
              'The same contrast across the whole picture'],
             'It takes a few tries to judge how light the distance should be. Squint and compare with the reference.'),
  'env-3': G('This unit brings perspective, value and composition together. Designing your own scene shows you what you\'ve learned.',
             ['Start from a real place, then decide what to change.',
              'Decide where the light comes from.',
              'Make three thumbnails.',
              'Choose the strongest and draw it.'],
             ['Starting the final drawing without thumbnails',
              'Changing the light halfway through',
              'Adding everything you can think of'],
             'Your scene won\'t match the picture in your head. That gap is normal, and it gets smaller the more you draw.'),
}

PATH = [
  ['fig-1', 'per-1', 'val-1'], ['head-1', 'per-2', 'com-1'], ['fig-2', 'val-2', 'com-2'], ['head-2', 'per-3', 'col-1'],
  ['fig-3', 'ani-1', 'val-3'], ['head-3', 'env-1', 'col-2'], ['ani-2', 'per-4', 'com-3'], ['fig-4', 'env-2', 'col-3'],
  ['head-4', 'ani-3', 'val-4'], ['env-3', 'com-4', 'col-4'],
]


def page_body(cur):
    """The generated part of the /curriculum/ web page."""
    esc = html.escape
    units = {u['id']: (t, u) for t in cur['tracks'] for u in t['units']}
    n_units = len(units); n_ex = sum(len(u['ex']) for _, u in units.values())
    n_img = sum(len(s['items']) for s in cur['sets'].values())
    n_rendered = sum(len(s['items']) for s in cur['sets'].values() if s['items'] and 'src' in s['items'][0])
    terms = ''.join(
        f'<li class="cur-term"><span class="cur-n">{i + 1}</span><ul>' + ''.join(
            f'<li><a href="/practice/#learn/{uid}"><small>{esc(units[uid][0]["name"])} {units[uid][1]["level"]}</small>{esc(units[uid][1]["title"])}</a></li>' for uid in ids) + '</ul></li>'
        for i, ids in enumerate(cur['path']))
    tracks = ''.join(
        f'<section class="cur-track" id="{t["id"]}"><h3>{esc(t["name"])}</h3><p class="muted">{esc(t["blurb"])}</p><ol>' + ''.join(
            f'<li><a href="/practice/#learn/{u["id"]}"><b>{esc(u["title"])}</b></a><span>{esc(u["goal"])}</span></li>' for u in t['units']) + '</ol></section>'
        for t in cur['tracks'])
    return f"""<!-- generated:curriculum (tools/build_curriculum.py) -->
<header class="page-head">
  <span class="lbl">Curriculum</span>
  <h1>A path through the skills of drawing</h1>
  <p>{len(cur['tracks'])} skill tracks and {n_units} units, each practiced with timed references. Follow the suggested order in {len(cur['path'])} terms, or pick any track.</p>
  <div class="cta-row"><a class="btn primary big" href="/practice/#learn">Start the curriculum</a></div>
</header>
<section class="stats">
  <div class="stat"><b>{n_units}</b><span class="stat-label">units in {len(cur['path'])} terms</span><p>Three units a term, mixing subjects so you don’t spend months on one. {esc(cur['pace'])}</p></div>
  <div class="stat"><b>{n_ex}</b><span class="stat-label">exercises</span><p>Timed poses, longer studies, Studio exercises you check against the reference, and drawing from memory.</p></div>
  <div class="stat"><b>{n_img}</b><span class="stat-label">references</span><p>{n_rendered} rendered for practice, and {n_img - n_rendered} public-domain master works from the Art Institute of Chicago.</p></div>
</section>
<section class="band-in">
  <div class="sec-head"><h2>The suggested path</h2><p>Each term takes three units from different tracks. Click a unit to open it in the app.</p></div>
  <ol class="cur-terms">{terms}</ol>
</section>
<section class="band-in">
  <div class="sec-head"><h2>The tracks</h2><p>Every track starts simple and ends with studies from the masters.</p></div>
  <div class="cur-tracks">{tracks}</div>
</section>
<!-- /generated:curriculum -->"""


def update_page(cur):
    if not os.path.exists(PAGE):
        return False
    page = open(PAGE, encoding='utf-8').read()
    new, n = re.subn(r'<!-- generated:curriculum.*?<!-- /generated:curriculum -->', lambda m: page_body(cur), page, flags=re.S)
    if n:
        open(PAGE, 'w', encoding='utf-8').write(new)
    return bool(n)


def main():
    sets = {}
    for sid, name in LOCAL.items():
        d = os.path.join(REFS, sid)
        files = sorted(f for f in os.listdir(d) if f.endswith('.webp'))
        items = []
        for f in files:
            w, h = webp_size(os.path.join(d, f))
            items.append({'src': f'refs/{sid}/{f}', 'w': w, 'h': h})
        sets[sid] = {'name': name, 'credit': 'Rendered by Sketch Hour', 'items': items}
    museum = json.load(open(os.path.join(HERE, 'museum.json'), encoding='utf-8'))
    for sid, (key, name) in MUSEUM.items():
        items = []
        for aid, image, title, artist, date, w, h in museum[key]:
            items.append({'aic': image, 'id': aid, 'w': w, 'h': h, 'title': title, 'artist': artist, 'date': date})
        sets[sid] = {'name': name, 'credit': 'Art Institute of Chicago, public domain (CC0)', 'items': items}

    seen_units, seen_ex = set(), set()
    for tr in TRACKS:
        for lv, u in enumerate(tr['units'], 1):
            u['level'] = lv
            assert u['id'] not in seen_units, u['id']; seen_units.add(u['id'])
            assert u['id'] in GUIDE, f"no lesson text for {u['id']}"
            u.update(GUIDE[u['id']])
            for i, e in enumerate(u['ex']):
                e['id'] = f"{u['id']}{'abcdef'[i]}"
                assert e['id'] not in seen_ex; seen_ex.add(e['id'])
                if 'set' in e: assert e['set'] in sets, e['set']
    flat = [x for t in PATH for x in t]
    assert sorted(flat) == sorted(seen_units), set(seen_units) ^ set(flat)
    assert set(GUIDE) == seen_units, set(GUIDE) ^ seen_units

    out = {'version': 1, 'pace': 'About a month per unit, three units per term.',
           'sets': sets, 'tracks': TRACKS, 'path': PATH}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    n_ex = len(seen_ex); n_img = sum(len(s['items']) for s in sets.values())
    if update_page(out): print(f'updated {PAGE}')
    print(f'wrote {OUT}: {len(TRACKS)} tracks, {len(seen_units)} units, {n_ex} exercises, {len(sets)} sets, {n_img} images, {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    main()
