import * as B from "@babylonjs/core/pure";
import * as S from "@preact/signals";
import asgn from "./asgn";


// Importing the "pure" version of BabylonJS above improves tree shaking of the
// production build but requires explicit calls to some "impure" registration
// functions.  The currently used Babylon features need these registrations:
B.RegisterCoreEngineExtensions();
B.RegisterEngineUniformBuffer();
// More sloppily (including a bit of unused code) we could use:
// B.RegisterStandardEngineExtensions();


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
const transformSig = rangeSig("#transform");
const transformOut = document.querySelector<HTMLOutputElement>("#transform-out")!;
S.effect(() => { transformOut.value = transformSig.value.toFixed(3); });
const edgesSig = checkboxSig("#edges");
const facesSig = checkboxSig("#faces");
const axesSig = checkboxSig("#axes");


const tween = (a: number, b: number) =>
  a * (1 - transformSig.value) + b * transformSig.value;
const signs = [1, -1];
const signed = (value: number) => signs.map(sgn => sgn * value);
const r5 = Math.sqrt(5);
const φ       = 0.5 * (1 + r5);
const φtransformed = 0.5 * (1 - r5);


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
    backFaceCulling: false,
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

const getCenter = (vertices: V3[]): V3 =>
  vertices.reduce((sum, vertex) => sum.addInPlace(vertex), V3.Zero())
  .scaleInPlace(1 / vertices.length);

function showFaces(sig: S.Signal<boolean>, verticesSig: S.Signal<V3[]>, faces: number[][]) {
  const getPositions = () => [
    ...verticesSig.value,
    // Add face centers so we can triangulate faces around them:
    ...faces.map(face => getCenter(face.map(idx => verticesSig.value[idx]))),
  ].flatMap(v => v.asArray());
  asgn(
    new B.Mesh("mesh", scene),
    m => {
      asgn(
        new B.VertexData(), {
          positions: getPositions(),
          indices: faces.flatMap((face, j) => {
            const center = verticesSig.value.length + j;
            return Array.from(face, (_, i) => [
              center,
              face[i],
              face[(i+1) % face.length],
            ]).flat();
          }),
        },
      ).applyToMesh(m, true);
      S.effect(() => { m.isVisible = sig.value && facesSig.value; });
      S.effect(() => {
        m.updateVerticesData(B.VertexBuffer.PositionKind, getPositions());
      });
    },
    {material},
  );
}

function showPolyhedron(name: string, verticesSig: S.Signal<V3[]>, faces: number[][]) {
  // console.log(
  //   name + "\n" +
  //   verticesSig.value.map((v, i) =>
  //     i.toString().padStart(2) + ":" +
  //     v.asArray().map(a => a.toFixed(1).padStart(6)).join("")
  //   ).join("\n"),
  // );
  const sig = S.computed(() => figureSig.value === name);
  showVertices(sig, verticesSig);
  showEdges(sig, verticesSig, faces);
  showFaces(sig, verticesSig, faces);
}

const icoVertices = S.computed(() =>
  signs.flatMap(a =>
    signed(tween(φ, φtransformed)).flatMap(b => [
      v3(a, b, 0),
      v3(0, a, b),
      v3(b, 0, a),
    ])
  ),
);

// TODO generate faces sytematically?
const icoFaces = [
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
];

showPolyhedron("icosahedron", icoVertices, icoFaces);

showPolyhedron(
  "dodecahedron",
  S.computed(() => [
    ... // 0..7
    signs.flatMap(a =>
      signs.flatMap(b =>
        signs.flatMap(c =>
          v3(a, b, c),
        )
      )
    ),
    ... // 8..19
    signed(-tween(φtransformed, φ)).flatMap(a =>
      signed(tween(φ, φtransformed)).flatMap(b => [
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
  ],
);

const icoFaceRotations = icoFaces.flatMap(([a,b,c]) =>
  [[a,b,c], [b,c,a], [c,a,b]] as [number, number, number][]
);
// For each of the 12 icosahedron vertices the pentagon of its 5 neighbors:
const great12hedronFaces = Array.from({length: 12}, (_, i) => {
  const [firstEdge, ...moreEdges] =
    icoFaceRotations.flatMap(([a,b,c]) =>
      a === i ? [[b,c] as [number, number]] : []
    );
  const face = firstEdge;
  while (face.length < 5) {
    face.push(moreEdges.find(([b]) => b === face.at(-1))![1]);
  }
  if (!moreEdges.find(([b,c]) => b === face.at(-1) && c === face[0])) {
    console.warn("great dodecahedron: face not closed", face);
  }
  return face;
});

showPolyhedron("great dodecahedron", icoVertices, great12hedronFaces);

// TODO more shapes?


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
