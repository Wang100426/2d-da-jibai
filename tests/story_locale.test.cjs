/**
 * 剧情语言包的模块化校验（node:test，无第三方依赖）。
 *
 * 剧情文案已经按「一张重现卡一个文件」拆到 `locale/story/<卡编号>.<语言>.json`。
 * 这个测试守住三件事：
 * 1. 每张卡三语齐全，分区与 `story_script.py` 完全对得上（不多不少）
 * 2. 三语的节点键、选项数、波次里的敌人/技能数完全一致（防止文案错位）
 * 3. 主语言包 `locale/*.json` 里不再残留 cards / sections
 *
 * 数据来源：`tests/fixtures/chapters.zh.json`（由 story_script 导出）
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LANGS = ["zh", "en", "ja"];
const STORY_DIR = path.join(__dirname, "..", "locale", "story");
const LOCALE_DIR = path.join(__dirname, "..", "locale");

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "chapters.zh.json"), "utf8"),
);
const sections = fixture.sections;
const cards = fixture.cards;

const nodeTypeOf = new Map();
sections.forEach((section) => {
  (section.nodes || []).forEach((node) => nodeTypeOf.set(`${section.id}/${node.id}`, node));
});

function cardPath(cardId, lang) {
  return path.join(STORY_DIR, `${cardId}.${lang}.json`);
}

function loadCard(cardId, lang) {
  const file = cardPath(cardId, lang);
  assert.ok(fs.existsSync(file), `缺少剧情语言包：${path.basename(file)}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sectionsOfCard(cardId) {
  return sections.filter((section) => section.card === cardId);
}

test("每张卡三语文件齐全，文件里的 id 与文件名一致", () => {
  assert.ok(cards.length > 0, "fixture 里没有重现卡");
  cards.forEach((card) => {
    LANGS.forEach((lang) => {
      const data = loadCard(card.id, lang);
      assert.equal(data.id, card.id, `${card.id}.${lang}.json 的 id 不匹配`);
      assert.ok(data.card && typeof data.card === "object", `${card.id}.${lang}.json 缺少 card 段`);
      assert.ok(data.sections && typeof data.sections === "object", `${card.id}.${lang}.json 缺少 sections`);
    });
  });
});

test("每张卡的分区与 story_script 完全一致", () => {
  cards.forEach((card) => {
    const expected = sectionsOfCard(card.id).map((section) => section.id).sort();
    assert.ok(expected.length > 0, `${card.id} 在 story_script 里没有分区`);
    LANGS.forEach((lang) => {
      const data = loadCard(card.id, lang);
      const actual = Object.keys(data.sections).sort();
      assert.deepEqual(actual, expected, `${card.id}.${lang}.json 的分区与剧情配置不一致`);
    });
  });
});

test("三语的节点键完全一致（不增不减）", () => {
  cards.forEach((card) => {
    const perLang = LANGS.map((lang) => {
      const data = loadCard(card.id, lang);
      const map = {};
      Object.entries(data.sections).forEach(([sectionId, section]) => {
        map[sectionId] = Object.keys(section.nodes || {}).sort();
      });
      return { lang, map };
    });
    const base = perLang[0];
    perLang.slice(1).forEach((entry) => {
      Object.keys(base.map).forEach((sectionId) => {
        assert.deepEqual(
          entry.map[sectionId],
          base.map[sectionId],
          `${card.id}/${sectionId}: ${base.lang} 与 ${entry.lang} 的节点键不一致`,
        );
      });
    });
  });
});

test("每类节点的文案都非空，且与结构数量对齐", () => {
  cards.forEach((card) => {
    LANGS.forEach((lang) => {
      const data = loadCard(card.id, lang);
      Object.entries(data.sections).forEach(([sectionId, section]) => {
        assert.ok(section.title, `${card.id}/${sectionId}.${lang}: 分区标题为空`);
        assert.ok(section.summary, `${card.id}/${sectionId}.${lang}: 分区摘要为空`);
        Object.entries(section.nodes || {}).forEach(([nodeId, text]) => {
          const structural = nodeTypeOf.get(`${sectionId}/${nodeId}`);
          assert.ok(structural, `剧情配置里找不到节点 ${sectionId}/${nodeId}`);
          const where = `${card.id}/${sectionId}/${nodeId}.${lang}`;
          if (structural.type === "dialogue") {
            assert.ok(text.text, `${where}: 对话正文为空`);
            assert.ok(text.speaker, `${where}: 说话人为空`);
          } else if (structural.type === "choice") {
            assert.ok(text.prompt, `${where}: 选项提示为空`);
            assert.equal(
              (text.options || []).length,
              (structural.options || []).length,
              `${where}: 选项数量与剧情配置不一致`,
            );
          } else if (structural.type === "battle") {
            assert.ok(text.title, `${where}: 战斗标题为空`);
            assert.ok(text.brief, `${where}: 战斗简报为空`);
            const waves = text.waves || [];
            assert.equal(waves.length, (structural.waves || []).length, `${where}: 波次数量不一致`);
            waves.forEach((wave, index) => {
              assert.ok(wave.label, `${where} 第 ${index + 1} 波: 缺少波次名`);
              assert.ok(wave.note, `${where} 第 ${index + 1} 波: 缺少副标题`);
              const configured = structural.waves[index] || {};
              assert.equal(
                (wave.enemies || []).length,
                (configured.enemies || []).length,
                `${where} 第 ${index + 1} 波: 敌人数与剧情配置不一致`,
              );
              assert.equal(
                (wave.skills || []).length,
                (configured.skills || []).length,
                `${where} 第 ${index + 1} 波: 技能数与剧情配置不一致`,
              );
              (wave.skills || []).forEach((skill, skillIndex) => {
                assert.ok(skill.name, `${where} 第 ${index + 1} 波技能 ${skillIndex + 1}: 缺少技能名`);
              });
            });
          } else if (structural.type === "objective") {
            assert.ok(text.title, `${where}: 目标标题为空`);
            assert.ok(text.description, `${where}: 目标说明为空`);
            assert.equal(
              (text.goals || []).length,
              (structural.goals || []).length,
              `${where}: 目标数量与剧情配置不一致`,
            );
          } else if (structural.type === "reward") {
            assert.ok(text.title, `${where}: 奖励标题为空`);
            assert.ok(text.description, `${where}: 奖励说明为空`);
          } else if (structural.type === "chapter_end") {
            assert.ok(text.title, `${where}: 结束标题为空`);
            assert.ok(text.text, `${where}: 结束正文为空`);
          }
        });
      });
    });
  });
});

test("卡面文案三语齐全（编号 / 标题 / 摘要 / 引言）", () => {
  cards.forEach((card) => {
    LANGS.forEach((lang) => {
      const { card: meta } = loadCard(card.id, lang);
      ["code", "title", "summary", "quote"].forEach((key) => {
        assert.ok(meta[key], `${card.id}.${lang}.json 的 card.${key} 为空`);
      });
      assert.equal(meta.code, card.code, `${card.id}.${lang}.json 的编号与配置不一致`);
    });
  });
});

test("分区所属的卡与 story_script 一致（没有放错文件）", () => {
  const known = new Set(sections.map((section) => section.id));
  const seen = new Set();
  cards.forEach((card) => {
    LANGS.forEach((lang) => {
      const data = loadCard(card.id, lang);
      Object.keys(data.sections).forEach((sectionId) => {
        assert.ok(known.has(sectionId), `${card.id}.${lang}.json 有未知分区 ${sectionId}`);
        assert.equal(
          sections.find((section) => section.id === sectionId).card,
          card.id,
          `${sectionId} 被放进了错误的卡 ${card.id}`,
        );
        seen.add(sectionId);
      });
    });
  });
  assert.equal(seen.size, known.size, "有分区没有出现在任何卡文件里");
});

test("主语言包只保留分类，不再持有 cards / sections", () => {
  LANGS.forEach((lang) => {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, `${lang}.json`), "utf8"));
    const story = data.story || {};
    assert.ok(!("cards" in story), `locale/${lang}.json 仍残留 story.cards`);
    assert.ok(!("sections" in story), `locale/${lang}.json 仍残留 story.sections`);
    assert.ok(story.categories && Object.keys(story.categories).length >= 2, `locale/${lang}.json 缺少 story.categories`);
  });
});
