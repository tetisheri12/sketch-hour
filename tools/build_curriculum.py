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
def FREE(mins, title, how):
    return dict(t='free', min=mins, title=title, how=how)

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
             FREE(20, 'A page of boxes', 'Fill a page with boxes from imagination in two point perspective.')]),
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
             STUDY('color-forms', 20, 'One scene, 20 minutes', 'A full color study.')]),
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
             STUDIO('m-landscape', 45, 'Copy and compare', 'Copy a landscape, then check it in Compare.')]),
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
<section class="cur-how">
  <div class="device"><h3>{n_units} units, {len(cur['path'])} terms</h3><p>Three units a term, mixing subjects so you don’t spend months on one. {esc(cur['pace'])}</p></div>
  <div class="device"><h3>{n_ex} exercises</h3><p>Timed poses, longer studies, Studio exercises you check against the reference, and drawing from memory.</p></div>
  <div class="device"><h3>{n_img} references</h3><p>{n_rendered} rendered for practice, and {n_img - n_rendered} public-domain master works from the Art Institute of Chicago.</p></div>
</section>
<section class="band">
  <div class="band-head"><h2>The suggested path</h2><p>Each term takes three units from different tracks. Click a unit to open it in the app.</p></div>
  <ol class="cur-terms">{terms}</ol>
</section>
<section class="band">
  <div class="band-head"><h2>The tracks</h2><p>Every track starts simple and ends with studies from the masters.</p></div>
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
            for i, e in enumerate(u['ex']):
                e['id'] = f"{u['id']}{'abcdef'[i]}"
                assert e['id'] not in seen_ex; seen_ex.add(e['id'])
                if 'set' in e: assert e['set'] in sets, e['set']
    flat = [x for t in PATH for x in t]
    assert sorted(flat) == sorted(seen_units), set(seen_units) ^ set(flat)

    out = {'version': 1, 'pace': 'About a month per unit, three units per term.',
           'sets': sets, 'tracks': TRACKS, 'path': PATH}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    n_ex = len(seen_ex); n_img = sum(len(s['items']) for s in sets.values())
    if update_page(out): print(f'updated {PAGE}')
    print(f'wrote {OUT}: {len(TRACKS)} tracks, {len(seen_units)} units, {n_ex} exercises, {len(sets)} sets, {n_img} images, {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    main()
