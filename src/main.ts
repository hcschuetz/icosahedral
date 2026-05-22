import * as B from "@babylonjs/core";
import * as S from "@preact/signals";
import asgn from "./asgn";

function selectSig(selectors: string) {
  const el = document.querySelector<HTMLSelectElement>(selectors)!;
  const sig = S.signal<string>(el.value);
  el.addEventListener("input", () => sig.value = el.value);
  return sig;
}

function rangeSig(selectors: string) {
  const el = document.querySelector<HTMLInputElement>(selectors)!;
  const sig = S.signal<number>(Number.parseFloat(el.value));
  el.addEventListener("input", () => sig.value = Number.parseFloat(el.value));
  return sig;
}

function checkboxSig(selectors: string) {
  const el = document.querySelector<HTMLInputElement>(selectors)!;
  const sig = S.signal<boolean>(el.checked);
  el.addEventListener("change", () => sig.value = el.checked);
  return sig;
}

const figureSig = selectSig("#figure");
const interpolateSig = rangeSig("#interpolate");
const interpolateOut = document.querySelector<HTMLOutputElement>("#interpolate-out")!;
S.effect(() => { interpolateOut.value = interpolateSig.value.toFixed(3); });
const edgesSig = checkboxSig("#edges");
const facesSig = checkboxSig("#faces");
const axesSig = checkboxSig("#axes");


const r5 = Math.sqrt(5);
const φ    = 0.5 * (r5 + 1);
const φRev = 0.5 * (-r5 + 1);
const φSig = S.computed(() =>
  interpolateSig.value       * φRev +
  (1 - interpolateSig.value) * φ
);

// We do not compute φInvSig as 1 / φSig using the interpolated value φSig.
// We rather interpolate it linearly between 1 / φ and 1 / φRev.
// This ensures that vertices move linearly as well.
// TODO Compute each vertex twice, namely based on φ and φRev.  Then perform a
// linear interpolation between these two vertices (using some Babylon helper function).
// For this showPolyhedron takes a function 
const φInvSig = S.computed(() =>
  interpolateSig.value       / φRev +
  (1 - interpolateSig.value) / φ
);


type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);


const canvasEl = document.querySelector<HTMLCanvasElement>("#the-canvas")!;
const engine = new B.Engine(canvasEl);
const scene = new B.Scene(engine);

asgn(new B.ArcRotateCamera("camera", 0, 0, 0, V3.ZeroReadOnly, scene), c => {
  c.setPosition(v3(2, 3, -8));
  c.setTarget(V3.Zero());
  c.attachControl(canvasEl);
});

// asgn(new B.HemisphericLight("light", v3(0, 1, 0), scene), {intensity: 1});
asgn(new B.PointLight("light1", v3( 10,  10,  10), scene), {intensity: .7});
asgn(new B.PointLight("light2", v3( 10, -10, -10), scene), {intensity: .7});
asgn(new B.PointLight("light3", v3(-10,  10, -10), scene), {intensity: .7});
asgn(new B.PointLight("light4", v3(-10, -10,  10), scene), {intensity: .7});

const material = asgn(
  new B.StandardMaterial("mat", scene), {
    diffuseColor: B.Color3.White(),
  },
);

function showVertices(sig: S.Signal<boolean>, verticesSig: S.Signal<V3[]>) {
  verticesSig.value.forEach((_, i) => {
    asgn(
      B.CreateSphere("vertex_" + i, {
        segments: 6,
        diameter: 0.04,
      }),
      s => {
        S.effect(() => { s.position = verticesSig.value[i]; });
        S.effect(() => { s.isVisible = sig.value && edgesSig.value; })
      },
      {material},
    );
  });
}

function showEdges(sig: S.Signal<boolean>, verticesSig: S.Signal<V3[]>, faces: number[][]) {
  new Map(faces.flatMap(face => face.map((p, i) => {
    const q = face.at(i-1)!;
    const pair = p < q ? [p, q] : [q, p];
    return [pair.join("-"), pair] as [string, [number, number]];
  })))
  .forEach(indices => {
    // TODO re-use the path object, just with new values
    asgn(
      B.CreateTube("edge", {
        path: indices.map(i => verticesSig.value[i]),
        radius: 0.02,
        updatable: true,
      }),
      {material},
      t => {
        S.effect(() => { t.isVisible = sig.value && edgesSig.value; });
        S.effect(() => {
          B.CreateTube("edge", {
            instance: t,
            path: indices.map(i => verticesSig.value[i]),
          })
        });
      }
    );
  });
}

function showFaces(sig: S.Signal<boolean>, verticesSig: S.Signal<V3[]>, faces: number[][]) {
  asgn(
    new B.Mesh("mesh", scene),
    m => {
      asgn(
        new B.VertexData(), {
          positions: verticesSig.value.flatMap(v => v.asArray()),
          indices: faces.flatMap(face =>
            Array.from({length: face.length - 2}, (_, i) => [
              face[i],
              face[i+1],
              face.at(-1)!,
            ]).flat()
          ),
        },
      ).applyToMesh(m, true);
      S.effect(() => { m.isVisible = sig.value && facesSig.value; });
      // TODO S.computed for `verticesSig.value.flatMap(v => v.asArray())`?
      S.effect(() => {
        m.updateVerticesData(
          B.VertexBuffer.PositionKind,
          verticesSig.value.flatMap(v => v.asArray()),
        );
      });
    },
    {material},
  );
}

function showPolyhedron(name: string, verticesSig: S.Signal<V3[]>, faces: number[][]) {
  // console.log(
  //   name + "\n" +
  //   vertices.map((v, i) =>
  //     i.toString().padStart(2) + ":" +
  //     v.asArray().map(a => a.toFixed(1).padStart(6)).join("")
  //   ).join("\n"),
  // );
  const sig = S.computed(() => figureSig.value === name);
  showVertices(sig, verticesSig);
  showEdges(sig, verticesSig, faces);
  showFaces(sig, verticesSig, faces);
}

showPolyhedron(
  "icosahedron",
  S.computed(() =>
    [1, -1].flatMap(a =>
      [φSig.value, -φSig.value].flatMap(b => [
        v3(a, b, 0),
        v3(0, a, b),
        v3(b, 0, a),
      ])
    ),
  ),
  // TODO generate faces sytematically?
  [
    [0,2,1],
    [0,4,8],
    [7,2,3],
    [6,1,5],
    [4,6,11],
    [8,10,3],
    [9,5,7],
    [9,10,11],

    [2,0,8],
    [2,8,3],
    [5,11,6],
    [5,9,11],

    [0,1,6],
    [0,6,4],
    [3,9,7],
    [3,10,9],

    [1,2,7],
    [1,7,5],
    [4,10,8],
    [4,11,10],
  ],
);

showPolyhedron(
  "dodecahedron",
  S.computed(() => [
    ... // 0..7
    [1, -1].flatMap(a =>
      [1, -1].flatMap(b =>
        [1, -1].flatMap(c =>
          v3(a, b, c),
        )
      )
    ),
    ... // 8..19
    [φInvSig.value, -φInvSig.value].flatMap(a =>
      [φSig.value, -φSig.value].flatMap(b => [
        v3(a, 0, b),
        v3(b, a, 0),
        v3(0, b, a),
      ])
    ),
  ]),
  // TODO generate faces sytematically?
  [
    [16, 1,  9, 0, 10],
    [10, 4, 12, 5, 16],
    [13, 2, 15, 3, 19],
    [19, 7, 18, 6, 13],

    [11, 1, 16, 5, 17],
    [17, 7, 19, 3, 11],
    [14, 4, 10, 0,  8],
    [ 8, 2, 13, 6, 14],

    [ 9, 1, 11, 3, 15],
    [15, 2,  8, 0,  9],
    [18, 7, 17, 5, 12],
    [12, 4, 14, 6, 18],
    // With interpolateSig.value = 0 these are pentagons, which we can draw
    // correctly.  With interpolateSig.value = 1 these will be pentagrams,
    // which my current polygon-drawing algorithm doesn't draw correctly.
    // It expects a (plane and) convex polygon.
    // TODO Support pentagrams and other non-convex (but plane) polygons? How?
  ],
);

// TODO more shapes
// (in particular some other stellated icosahedron; same vertices but different triangles)


const axisShape = [
// along/across the arrow
  [ 2.5, 0   ],  // tip
  [ 2.2, 0.1 ],
  [ 2.2, 0.02],
  [-2.5, 0.02],
  [-2.5, 0   ],  // end
];

[v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].forEach((dir, j) => {
  asgn(
    B.CreateTube("Axis" + j, {
      path: axisShape.map(p => dir.scale(p[0])),
      radiusFunction: i => axisShape[i][1],
    }, scene),
    {
      material: asgn(
        new B.StandardMaterial("axisMat" + j, scene),
        {diffuseColor: new B.Color3(dir.x, dir.y, dir.z)},
      ),
    },
    a => { S.effect(() => {a.isVisible = axesSig.value}); },
  );
});


engine.runRenderLoop(() => {
  scene.render();
});
