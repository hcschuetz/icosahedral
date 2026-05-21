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
const edgesSig = checkboxSig("#edges");
const facesSig = checkboxSig("#faces");
const axesSig = checkboxSig("#axes");
// TODO use interpolateSig; more shapes;

const φ = 0.5 * (1 + Math.sqrt(5));
const φinv = 0.5 * (-1 + Math.sqrt(5));


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

function showVertices(sig: S.Signal<boolean>, vertices: V3[]) {
  vertices.forEach((v, i) => {
    asgn(
      B.CreateSphere("vertex_" + i, {
        segments: 6,
        diameter: 0.04,
      }),
      s => {
        s.position = v;
        S.effect(() => { s.isVisible = sig.value && edgesSig.value; })
      },
      {material},
    );
  });
}

function showEdges(sig: S.Signal<boolean>, vertices: V3[], faces: number[][]) {
  new Map(faces.flatMap(face => face.map((p, i) => {
    const q = face.at(i-1)!;
    const pair = p < q ? [p, q] : [q, p];
    return [pair.join("-"), pair] as [string, [number, number]];
  })))
  .forEach(indices => asgn(
    B.CreateTube("edge", {
      path: indices.map(i => vertices[i]),
      radius: 0.02,
    }),
    {material},
    t => {
      S.effect(() => { t.isVisible = sig.value && edgesSig.value; });
    }
  ));
}

function showFaces(sig: S.Signal<boolean>, vertices: V3[], faces: number[][]) {
  asgn(
    new B.Mesh("mesh", scene),
    m => {
      asgn(
        new B.VertexData(), {
          positions: vertices.flatMap(v => v.asArray()),
          indices: faces.flatMap(face =>
            Array.from({length: face.length - 2}, (_, i) => [
              face[i],
              face[i+1],
              face.at(-1)!,
            ]).flat()
          ),
        },
      ).applyToMesh(m);
      S.effect(() => { m.isVisible = sig.value && facesSig.value; });
    },
    {material},
  );
}

function showPolyhedron(name: string, vertices: V3[], faces: number[][]) {
  // console.log(
  //   name + "\n" +
  //   vertices.map((v, i) =>
  //     i.toString().padStart(2) + ":" +
  //     v.asArray().map(a => a.toFixed(1).padStart(6)).join("")
  //   ).join("\n"),
  // );
  const sig = S.computed(() => figureSig.value === name);
  showVertices(sig, vertices);
  showEdges(sig, vertices, faces);
  showFaces(sig, vertices, faces);
}

showPolyhedron(
  "icosahedron",
  [1, -1].flatMap(a =>
    [φ, -φ].flatMap(b => [
      v3(a, b, 0),
      v3(0, a, b),
      v3(b, 0, a),
    ])
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
  [
    ... // 0..7
    [1, -1].flatMap(a =>
      [1, -1].flatMap(b =>
        [1, -1].flatMap(c =>
          v3(a, b, c),
        )
      )
    ),
    ... // 8..19
    [φinv, -φinv].flatMap(a =>
      [φ, -φ].flatMap(b => [
        v3(a, 0, b),
        v3(b, a, 0),
        v3(0, b, a),
      ])
    )
  ],
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
